import {randomUUID} from "node:crypto";
import {mkdir, readFile, readdir, rename, rm, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {normalizeDeploymentRequest, validateSecretFree} from "./schema.mjs";

const DEPLOYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const STATES = new Set([
  "queued",
  "running",
  "verifying",
  "verified",
  "failed",
  "rolling_back",
  "rolled_back",
]);
const TRANSITIONS = new Map([
  ["queued", new Set(["running"])],
  ["running", new Set(["verifying", "failed"])],
  ["verifying", new Set(["verified", "failed"])],
  ["verified", new Set(["rolling_back"])],
  ["rolling_back", new Set(["rolled_back", "failed"])],
  ["failed", new Set(["queued"])],
  ["rolled_back", new Set()],
]);

function assertDeploymentId(value) {
  const id = String(value ?? "");
  if (!DEPLOYMENT_ID.test(id)) throw new TypeError("deploymentId must be a path-safe identifier");
  return id;
}

function json(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

async function writeJson(path, value, {exclusive = false} = {}) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, json(value), {
    encoding: "utf8",
    mode: 0o600,
    ...(exclusive ? {flag: "wx"} : {}),
  });
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), {recursive: true});
  const temp = path + ".tmp-" + process.pid + "-" + randomUUID();
  try {
    await writeFile(temp, json(value), {encoding: "utf8", mode: 0o600, flag: "wx"});
    await rename(temp, path);
  } finally {
    await rm(temp, {force: true});
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function cleanErrorCode(value) {
  const code = String(value ?? "deployment_failed");
  if (!/^[a-z][a-z0-9_.-]{0,127}$/.test(code)) {
    throw new TypeError("errorCode is invalid");
  }
  return code;
}

function cleanEvidence(value) {
  if (value == null) return null;
  const copy = structuredClone(value);
  validateSecretFree(copy, "evidence");
  return copy;
}

export class HerculesDeployStore {
  constructor(root) {
    if (!root) throw new TypeError("root is required");
    this.root = join(root, "deployments");
    this.queues = new Map();
  }

  deploymentDir(deploymentId) {
    return join(this.root, assertDeploymentId(deploymentId));
  }

  requestPath(deploymentId) {
    return join(this.deploymentDir(deploymentId), "request.json");
  }

  statePath(deploymentId) {
    return join(this.deploymentDir(deploymentId), "state.json");
  }

  async withLock(deploymentId, operation) {
    deploymentId = assertDeploymentId(deploymentId);
    const previous = this.queues.get(deploymentId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.queues.set(deploymentId, current);
    try {
      return await current;
    } finally {
      if (this.queues.get(deploymentId) === current) this.queues.delete(deploymentId);
    }
  }

  async create(request, {deploymentId = randomUUID()} = {}) {
    deploymentId = assertDeploymentId(deploymentId);
    const normalized = normalizeDeploymentRequest(request);
    const now = new Date().toISOString();
    const state = {
      deploymentId,
      status: "queued",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      lastErrorCode: null,
      deployEvidence: null,
      verificationEvidence: null,
      rollbackEvidence: null,
      history: [{status: "queued", at: now}],
    };

    const dir = this.deploymentDir(deploymentId);
    await mkdir(dir, {recursive: false}).catch((error) => {
      if (error?.code === "ENOENT") return mkdir(this.root, {recursive: true}).then(() => mkdir(dir));
      throw error;
    });
    try {
      await writeJson(this.requestPath(deploymentId), normalized, {exclusive: true});
      await writeJson(this.statePath(deploymentId), state, {exclusive: true});
    } catch (error) {
      await rm(dir, {recursive: true, force: true});
      if (error?.code === "EEXIST") {
        throw Object.assign(new Error("deployment already exists"), {statusCode: 409});
      }
      throw error;
    }
    return {deploymentId, request: normalized, state};
  }

  async get(deploymentId) {
    deploymentId = assertDeploymentId(deploymentId);
    const [request, state] = await Promise.all([
      readJson(this.requestPath(deploymentId)),
      readJson(this.statePath(deploymentId)),
    ]);
    return {deploymentId, request, state};
  }

  async list({status = null, limit = 100} = {}) {
    if (status != null && !STATES.has(status)) throw new TypeError("status is invalid");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new TypeError("limit must be an integer between 1 and 1000");
    }
    let entries;
    try {
      entries = await readdir(this.root, {withFileTypes: true});
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }

    const deployments = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !DEPLOYMENT_ID.test(entry.name)) continue;
      try {
        const deployment = await this.get(entry.name);
        if (!status || deployment.state.status === status) deployments.push(deployment);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    deployments.sort((a, b) => b.state.createdAt.localeCompare(a.state.createdAt));
    return deployments.slice(0, limit);
  }

  async transition(deploymentId, nextStatus, {
    errorCode = null,
    deployEvidence = undefined,
    verificationEvidence = undefined,
    rollbackEvidence = undefined,
  } = {}) {
    deploymentId = assertDeploymentId(deploymentId);
    if (!STATES.has(nextStatus)) throw new TypeError("next deployment status is invalid");

    return this.withLock(deploymentId, async () => {
      const current = await readJson(this.statePath(deploymentId));
      const allowed = TRANSITIONS.get(current.status);
      if (!allowed?.has(nextStatus)) {
        throw Object.assign(
          new Error("invalid deployment transition: " + current.status + " -> " + nextStatus),
          {statusCode: 409},
        );
      }

      const now = new Date().toISOString();
      const state = {
        ...current,
        status: nextStatus,
        attempts: nextStatus === "running" ? current.attempts + 1 : current.attempts,
        updatedAt: now,
        lastErrorCode: nextStatus === "failed" ? cleanErrorCode(errorCode) : null,
        deployEvidence: deployEvidence === undefined ? current.deployEvidence : cleanEvidence(deployEvidence),
        verificationEvidence: verificationEvidence === undefined
          ? current.verificationEvidence
          : cleanEvidence(verificationEvidence),
        rollbackEvidence: rollbackEvidence === undefined
          ? current.rollbackEvidence
          : cleanEvidence(rollbackEvidence),
        history: [...current.history, {status: nextStatus, at: now}].slice(-100),
      };
      await writeJsonAtomic(this.statePath(deploymentId), state);
      return state;
    });
  }

  async requeue(deploymentId) {
    return this.transition(deploymentId, "queued");
  }
}
