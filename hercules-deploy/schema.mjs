export const HERCULES_DEPLOY_SPEC_VERSION = "0.1";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SECRET_KEY = /(password|token|secret|authorization|cookie|csrf|private.?key|api.?key)/i;

function requiredId(label, value) {
  const normalized = String(value ?? "");
  if (!ID.test(normalized)) throw new TypeError(label + " must be a path-safe identifier");
  return normalized;
}

function cleanText(label, value, max = 256) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max || /[\r\n]/.test(normalized)) {
    throw new TypeError(label + " is invalid");
  }
  return normalized;
}

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    throw new TypeError("publicOrigin must be a valid URL");
  }
  if (url.protocol !== "https:") throw new TypeError("publicOrigin must use https");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new TypeError("publicOrigin must be an HTTPS origin without credentials, path, query, or fragment");
  }
  return url.origin;
}

function validateSecretFree(value, path = "metadata", depth = 0) {
  if (depth > 8) throw new TypeError(path + " nesting is too deep");
  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(path + " numbers must be finite");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 100) throw new TypeError(path + " arrays are too large");
    value.forEach((entry, index) => validateSecretFree(entry, path + "[" + index + "]", depth + 1));
    return;
  }
  if (typeof value !== "object") throw new TypeError(path + " must be JSON-compatible");
  const entries = Object.entries(value);
  if (entries.length > 100) throw new TypeError(path + " objects are too large");
  for (const [key, entry] of entries) {
    if (SECRET_KEY.test(key)) {
      throw new TypeError(path + " may not include secret-shaped field: " + key);
    }
    validateSecretFree(entry, path + "." + key, depth + 1);
  }
}

function normalizeTarget(target) {
  if (!target || typeof target !== "object") throw new TypeError("target is required");
  const kind = requiredId("target.kind", target.kind);
  const reference = cleanText("target.reference", target.reference, 512);
  if (/\s/.test(reference)) throw new TypeError("target.reference may not contain whitespace");
  if (reference.includes("://")) {
    const url = new URL(reference);
    if (url.username || url.password) {
      throw new TypeError("target.reference must not embed credentials");
    }
  }
  return {kind, reference};
}

export function normalizeDeploymentRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("deployment request is required");
  }
  const serviceId = requiredId("serviceId", input.serviceId);
  const releaseId = requiredId("releaseId", input.releaseId);
  const sourceCommit = String(input.sourceCommit ?? "").toLowerCase();
  if (!SHA40.test(sourceCommit)) throw new TypeError("sourceCommit must be a 40-character git SHA");
  const artifactFingerprint = String(input.artifactFingerprint ?? "").toLowerCase();
  if (!SHA256.test(artifactFingerprint)) {
    throw new TypeError("artifactFingerprint must be a SHA-256 hex digest");
  }
  const publicOrigin = normalizeOrigin(input.publicOrigin);
  const target = normalizeTarget(input.target);
  const metadata = input.metadata == null ? {} : structuredClone(input.metadata);
  validateSecretFree(metadata);

  return {
    version: HERCULES_DEPLOY_SPEC_VERSION,
    serviceId,
    releaseId,
    sourceCommit,
    artifactFingerprint,
    publicOrigin,
    target,
    metadata,
  };
}

export {validateSecretFree};
