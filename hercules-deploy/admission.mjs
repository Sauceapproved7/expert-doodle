import {createHash} from "node:crypto";
import {appendFile, mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {validateSecretFree} from "./schema.mjs";

const VERSION = 1;
const DEPLOYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const EVENT_TYPE = /^[a-z][a-z0-9._-]{1,127}$/;
const OUTCOMES = new Set(["success", "failure", "blocked"]);
const MAX_EVENT_BYTES = 16 * 1024;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function cleanDeploymentId(value) {
  const id = String(value ?? "");
  if (!DEPLOYMENT_ID.test(id)) throw new TypeError("deploymentId must be a path-safe identifier");
  return id;
}

function eventPayload(event) {
  return {
    version: event.version,
    sequence: event.sequence,
    timestamp: event.timestamp,
    deploymentId: event.deploymentId,
    type: event.type,
    outcome: event.outcome,
    details: event.details,
    previousHash: event.previousHash,
  };
}

function verifyEvent(event, sequence, previousHash) {
  if (event.version !== VERSION) throw new Error("flight event version mismatch");
  if (event.sequence !== sequence) throw new Error("flight event sequence mismatch");
  if (typeof event.timestamp !== "string" || !Number.isFinite(Date.parse(event.timestamp))) {
    throw new Error("flight event timestamp invalid");
  }
  cleanDeploymentId(event.deploymentId);
  if (!EVENT_TYPE.test(String(event.type ?? ""))) throw new Error("flight event type invalid");
  if (!OUTCOMES.has(event.outcome)) throw new Error("flight event outcome invalid");
  validateSecretFree(event.details ?? {}, "details");
  if (event.previousHash !== previousHash) throw new Error("flight event previous hash mismatch");
  const expectedHash = sha256(JSON.stringify(eventPayload(event)));
  if (event.hash !== expectedHash) throw new Error("flight event hash mismatch");
}

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), {recursive: true});
  const temporary = path + ".tmp-" + process.pid + "-" + Date.now();
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await rename(temporary, path);
}

async function readEvents(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  if (!text.trim()) return [];

  const events = [];
  let previousHash = null;
  const lines = text.split("\n").filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    let event;
    try {
      event = JSON.parse(lines[index]);
    } catch {
      throw new Error("flight event JSON invalid at line " + (index + 1));
    }
    verifyEvent(event, index + 1, previousHash);
    events.push(event);
    previousHash = event.hash;
  }
  return events;
}

export class DeploymentFlightRecorder {
  constructor(recoveryRoot, {now = () => new Date()} = {}) {
    if (!recoveryRoot) throw new TypeError("recoveryRoot is required");
    if (typeof now !== "function") throw new TypeError("now must be a function");
    this.path = join(recoveryRoot, "deploy-flight", "events.jsonl");
    this.headPath = join(recoveryRoot, "deploy-flight", "head.json");
    this.now = now;
    this.queue = Promise.resolve();
  }

  async verify() {
    const events = await readEvents(this.path);
    const expected = {
      version: VERSION,
      lastSequence: events.at(-1)?.sequence ?? 0,
      lastHash: events.at(-1)?.hash ?? null,
    };
    const head = await readJsonOrNull(this.headPath);
    if (events.length === 0 && head == null) {
      return {verified: true, events: 0, ...expected};
    }
    if (
      !head ||
      head.version !== expected.version ||
      head.lastSequence !== expected.lastSequence ||
      head.lastHash !== expected.lastHash
    ) {
      throw new Error("flight head checkpoint mismatch");
    }
    return {
      verified: true,
      events: events.length,
      lastSequence: expected.lastSequence,
      lastHash: expected.lastHash,
    };
  }

  async append({
    deploymentId,
    type,
    outcome = "success",
    details = {},
  } = {}) {
    deploymentId = cleanDeploymentId(deploymentId);
    if (!EVENT_TYPE.test(String(type ?? ""))) throw new TypeError("flight event type is invalid");
    if (!OUTCOMES.has(outcome)) throw new TypeError("flight event outcome is invalid");
    validateSecretFree(details, "details");

    const previous = this.queue.catch(() => {});
    const current = previous.then(async () => {
      const events = await readEvents(this.path);
      const previousHash = events.at(-1)?.hash ?? null;
      const event = {
        version: VERSION,
        sequence: events.length + 1,
        timestamp: this.now().toISOString(),
        deploymentId,
        type,
        outcome,
        details: structuredClone(details),
        previousHash,
      };
      event.hash = sha256(JSON.stringify(eventPayload(event)));
      const line = JSON.stringify(event) + "\n";
      if (Buffer.byteLength(line) > MAX_EVENT_BYTES) {
        throw new TypeError("flight event exceeds maximum size");
      }
      await mkdir(dirname(this.path), {recursive: true});
      await appendFile(this.path, line, {encoding: "utf8", mode: 0o600});
      await writeJsonAtomic(this.headPath, {
        version: VERSION,
        lastSequence: event.sequence,
        lastHash: event.hash,
      });
      return event;
    });
    this.queue = current;
    try {
      return await current;
    } finally {
      if (this.queue === current) this.queue = Promise.resolve();
    }
  }
}

export class HerculesReleaseAdmissionGate {
  constructor({recorder} = {}) {
    if (!recorder || typeof recorder.verify !== "function" || typeof recorder.append !== "function") {
      throw new TypeError("recorder is required");
    }
    this.recorder = recorder;
  }

  async admit(deployment) {
    if (!deployment || typeof deployment !== "object") throw new TypeError("deployment is required");
    const deploymentId = cleanDeploymentId(deployment.deploymentId);
    if (deployment.state?.status !== "running") {
      throw Object.assign(new Error("release admission requires running deployment state"), {
        code: "release_admission_invalid_state",
      });
    }

    await this.recorder.verify();
    const request = deployment.request;
    const event = await this.recorder.append({
      deploymentId,
      type: "release.admission",
      outcome: "success",
      details: {
        serviceId: request.serviceId,
        releaseId: request.releaseId,
        sourceCommit: request.sourceCommit,
        artifactFingerprint: request.artifactFingerprint,
        publicOrigin: request.publicOrigin,
        targetKind: request.target.kind,
        targetReference: request.target.reference,
      },
    });

    return {
      admitted: true,
      deploymentId,
      releaseId: request.releaseId,
      sourceCommit: request.sourceCommit,
      artifactFingerprint: request.artifactFingerprint,
      flightSequence: event.sequence,
      flightHash: event.hash,
    };
  }
}
