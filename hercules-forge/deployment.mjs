import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {verifyForgeArtifact} from "./artifact.mjs";
import {ForgeDeploymentAdapter, ForgeLocalReleaseAdapter} from "./releases.mjs";

export const DEFAULT_DEPLOYMENT_MAX_BUNDLE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_FILES = 512;
const DEPLOYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,191}$/;

function validateHttpsOrLoopback(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(label + " must be a valid URL");
  }
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new TypeError(label + " must use https unless it is loopback");
  }
  if (url.username || url.password) {
    throw new TypeError(label + " must not embed credentials");
  }
  return url;
}

function validateDeploymentResult(value) {
  if (!value || typeof value !== "object") {
    throw new Error("deployment response must be an object");
  }
  const deploymentId = String(value.deploymentId ?? "");
  if (!DEPLOYMENT_ID.test(deploymentId)) {
    throw new Error("deployment response deploymentId is invalid");
  }
  let url = null;
  if (value.url != null) {
    url = validateHttpsOrLoopback(String(value.url), "deployment response url").toString();
  }
  return {
    deploymentId,
    url,
  };
}

export async function createForgeDeploymentBundle(
  artifactDir,
  {
    maxBundleBytes = DEFAULT_DEPLOYMENT_MAX_BUNDLE_BYTES,
    maxFiles = DEFAULT_MAX_FILES,
  } = {},
) {
  if (!Number.isSafeInteger(maxBundleBytes) || maxBundleBytes < 1024) {
    throw new TypeError("maxBundleBytes must be an integer of at least 1024");
  }
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 4096) {
    throw new TypeError("maxFiles must be an integer between 1 and 4096");
  }

  const manifest = await verifyForgeArtifact(artifactDir);
  const entries = Object.entries(manifest.files ?? {});
  if (entries.length > maxFiles) {
    throw new Error("verified artifact exceeds deployment file-count limit");
  }

  let totalBytes = 0;
  const files = [];
  for (const [path, expected] of entries) {
    totalBytes += expected.bytes;
    if (totalBytes > maxBundleBytes) {
      throw new Error("verified artifact exceeds deployment bundle byte limit");
    }
    const content = await readFile(join(artifactDir, "bundle", path));
    files.push({
      path,
      sha256: expected.sha256,
      bytes: expected.bytes,
      encoding: "base64",
      content: content.toString("base64"),
    });
  }

  return {
    protocol: "hercules-forge-deployment-bundle/0.1",
    manifest,
    files,
    totalBytes,
  };
}

export class ForgeDeploymentTransport {
  async publish() {
    throw new Error("ForgeDeploymentTransport.publish must be implemented");
  }

  async activate() {
    throw new Error("ForgeDeploymentTransport.activate must be implemented");
  }
}

export class HttpForgeDeploymentTransport extends ForgeDeploymentTransport {
  constructor({
    endpoint,
    token = null,
    timeoutMs = 30000,
    maxResponseBytes = 64 * 1024,
    fetchImpl = globalThis.fetch,
  }) {
    super();
    if (!endpoint) throw new TypeError("deployment endpoint is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) {
      throw new TypeError("timeoutMs must be between 1 and 120000");
    }
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
      throw new TypeError("maxResponseBytes must be a positive integer");
    }
    this.endpoint = validateHttpsOrLoopback(endpoint, "deployment endpoint").toString();
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
  }

  async request(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = {"content-type": "application/json"};
      if (this.token) headers.authorization = "Bearer " + this.token;
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("deployment request failed with status " + response.status);
      }
      const declaredLength = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
        throw new Error("deployment response too large");
      }
      const text = await response.text();
      if (Buffer.byteLength(text) > this.maxResponseBytes) {
        throw new Error("deployment response too large");
      }
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error("deployment response is not valid JSON");
      }
      return validateDeploymentResult(body);
    } finally {
      clearTimeout(timer);
    }
  }

  async publish({bundle}) {
    if (!bundle?.manifest?.verified || !bundle.manifest.artifactFingerprint) {
      throw new TypeError("verified deployment bundle is required");
    }
    return this.request({
      protocol: "hercules-forge-deployment/0.1",
      action: "publish",
      artifact: bundle,
    });
  }

  async activate({
    projectId,
    revisionId,
    artifactFingerprint,
    deploymentId,
  }) {
    if (!DEPLOYMENT_ID.test(String(deploymentId ?? ""))) {
      throw new TypeError("deploymentId is invalid");
    }
    return this.request({
      protocol: "hercules-forge-deployment/0.1",
      action: "activate",
      projectId,
      revisionId,
      artifactFingerprint,
      deploymentId,
    });
  }
}

export class ForgeRemoteReleaseAdapter extends ForgeDeploymentAdapter {
  constructor(
    root,
    {
      transport,
      maxBundleBytes = DEFAULT_DEPLOYMENT_MAX_BUNDLE_BYTES,
    } = {},
  ) {
    super();
    if (!transport || typeof transport.publish !== "function" || typeof transport.activate !== "function") {
      throw new TypeError("deployment transport is required");
    }
    this.local = new ForgeLocalReleaseAdapter(root);
    this.transport = transport;
    this.maxBundleBytes = maxBundleBytes;
  }

  async publish({projectId, revision, artifactDir}) {
    const bundle = await createForgeDeploymentBundle(artifactDir, {
      maxBundleBytes: this.maxBundleBytes,
    });
    const artifact = bundle.manifest;
    if (artifact.projectId !== projectId) {
      throw new Error("artifact project does not match release project");
    }
    if (artifact.revisionId !== revision.revisionId) {
      throw new Error("artifact revision does not match release revision");
    }
    if (artifact.revisionFingerprint !== revision.fingerprint) {
      throw new Error("artifact fingerprint does not match release revision");
    }

    const deployment = await this.transport.publish({bundle});
    return this.local.publish({
      projectId,
      revision,
      artifactDir,
      target: "remote-verified-deployment",
      deployment,
    });
  }

  async rollback({projectId, revisionId}) {
    const release = await this.local.getRelease(projectId, revisionId);
    if (!release.deployment?.deploymentId) {
      throw new Error("release does not have remote deployment metadata");
    }
    const deployment = await this.transport.activate({
      projectId,
      revisionId,
      artifactFingerprint: release.artifactFingerprint,
      deploymentId: release.deployment.deploymentId,
    });
    return this.local.rollback({projectId, revisionId, deployment});
  }

  async getActive(projectId) {
    return this.local.getActive(projectId);
  }
}
