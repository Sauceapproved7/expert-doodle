import {createHash} from "node:crypto";
import {fingerprint, validateShot} from "./core.mjs";

export const RENDER_JOB_STATES = Object.freeze([
  "queued",
  "running",
  "completed",
  "failed",
]);

const TRANSITIONS = Object.freeze({
  queued: new Set(["running", "failed"]),
  running: new Set(["completed", "failed"]),
  completed: new Set(),
  failed: new Set(["queued"]),
});

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_time");
  return date.toISOString();
}

function positiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(name);
  return number;
}

function optionalPositiveNumber(value, name) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(name);
  return number;
}

function normalizeReferences(references = []) {
  if (!Array.isArray(references)) throw new Error("render_references_invalid");
  return references.map((reference, index) => {
    if (!reference || typeof reference !== "object") throw new Error("render_reference_invalid:" + index);
    const kind = String(reference.kind || "");
    if (!["image", "video", "audio"].includes(kind)) throw new Error("render_reference_kind_invalid:" + index);
    const uri = String(reference.uri || "").trim();
    if (!uri) throw new Error("render_reference_uri_required:" + index);
    return {
      kind,
      uri,
      sha256: reference.sha256 ? normalizeSha256(reference.sha256) : null,
      role: reference.role ? String(reference.role) : null,
    };
  });
}

export function normalizeSha256(value) {
  const hash = String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("sha256_invalid");
  return hash;
}

export function sha256Bytes(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha256").update(buffer).digest("hex");
}

export function createRenderRequest({
  projectId,
  shot,
  resolution = "720p",
  fps = 24,
  container = "mp4",
  references = [],
  modelRef = null,
  seed = null,
}) {
  if (!String(projectId || "").trim()) throw new Error("project_id_required");
  const normalizedShot = validateShot(shot);
  const normalized = {
    schema: "sauceapproved.hercules.video-render-request",
    version: 1,
    projectId: String(projectId),
    shot: {
      id: normalizedShot.id,
      prompt: normalizedShot.prompt,
      durationSeconds: normalizedShot.durationSeconds,
      aspectRatio: normalizedShot.aspectRatio,
      requiresAudio: normalizedShot.requiresAudio === true,
      continuityGroup: normalizedShot.continuityGroup || null,
    },
    output: {
      resolution: String(resolution),
      fps: positiveInteger(fps, "render_fps_invalid"),
      container: String(container),
    },
    references: normalizeReferences(references),
    modelRef: modelRef == null ? null : String(modelRef),
    seed: seed == null ? null : Number(seed),
  };

  if (normalized.seed != null && !Number.isSafeInteger(normalized.seed)) {
    throw new Error("render_seed_invalid");
  }

  return {...normalized, requestFingerprint: fingerprint(normalized)};
}

export function createRenderJob(request, {
  now = new Date(),
  timeoutMs = 10 * 60 * 1000,
  maxAttempts = 3,
} = {}) {
  if (!request?.requestFingerprint) throw new Error("render_request_fingerprint_required");
  const createdAt = iso(now);
  const timeout = positiveInteger(timeoutMs, "render_timeout_invalid");
  const attempts = positiveInteger(maxAttempts, "render_max_attempts_invalid");
  const jobBase = {
    schema: "sauceapproved.hercules.video-render-job",
    version: 1,
    jobId: fingerprint({requestFingerprint: request.requestFingerprint, createdAt}).slice(0, 32),
    requestFingerprint: request.requestFingerprint,
    status: "queued",
    attempt: 0,
    maxAttempts: attempts,
    timeoutMs: timeout,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: null,
    deadlineAt: null,
    retryAt: null,
    artifact: null,
    error: null,
    history: [{status: "queued", at: createdAt, reason: "created"}],
  };
  return {...jobBase, stateFingerprint: fingerprint(jobBase)};
}

function withFingerprint(job) {
  const copy = {...job};
  delete copy.stateFingerprint;
  return {...copy, stateFingerprint: fingerprint(copy)};
}

export function transitionRenderJob(job, nextStatus, {
  now = new Date(),
  reason = null,
  artifact = null,
  error = null,
} = {}) {
  if (!RENDER_JOB_STATES.includes(job?.status)) throw new Error("render_job_status_invalid");
  if (!RENDER_JOB_STATES.includes(nextStatus)) throw new Error("render_next_status_invalid");
  if (!TRANSITIONS[job.status].has(nextStatus)) {
    throw new Error(`render_transition_invalid:${job.status}->${nextStatus}`);
  }

  const at = iso(now);
  const next = {
    ...job,
    status: nextStatus,
    updatedAt: at,
    history: [...(job.history || []), {status: nextStatus, at, reason: reason || null}],
  };

  if (job.status === "queued" && nextStatus === "running") {
    if (job.attempt >= job.maxAttempts) throw new Error("render_attempt_limit_reached");
    next.attempt = job.attempt + 1;
    next.startedAt = at;
    next.deadlineAt = new Date(new Date(at).getTime() + job.timeoutMs).toISOString();
    next.retryAt = null;
    next.error = null;
  }

  if (nextStatus === "completed") {
    if (!artifact) throw new Error("render_artifact_required");
    next.artifact = artifact;
    next.completedAt = at;
    next.deadlineAt = null;
    next.error = null;
  }

  if (nextStatus === "failed") {
    if (!error) throw new Error("render_error_required");
    next.error = normalizeRenderError(error);
    next.deadlineAt = null;
  }

  return withFingerprint(next);
}

export function normalizeRenderError(error) {
  if (typeof error === "string") {
    return {code: "render_failed", message: error, retryable: false};
  }
  if (!error || typeof error !== "object") throw new Error("render_error_invalid");
  return {
    code: String(error.code || "render_failed"),
    message: String(error.message || "Render failed"),
    retryable: error.retryable === true,
  };
}

export function renderJobTimedOut(job, now = new Date()) {
  if (job?.status !== "running" || !job.deadlineAt) return false;
  return new Date(now).getTime() >= new Date(job.deadlineAt).getTime();
}

export function failTimedOutRenderJob(job, now = new Date()) {
  if (!renderJobTimedOut(job, now)) return job;
  return transitionRenderJob(job, "failed", {
    now,
    reason: "timeout",
    error: {code: "render_timeout", message: "Render exceeded its Hercules timeout.", retryable: true},
  });
}

export function scheduleRenderRetry(job, {
  now = new Date(),
  baseDelayMs = 5000,
  maxDelayMs = 120000,
} = {}) {
  if (job?.status !== "failed") throw new Error("render_retry_requires_failed_job");
  if (!job.error?.retryable) throw new Error("render_error_not_retryable");
  if (job.attempt >= job.maxAttempts) throw new Error("render_attempt_limit_reached");

  const delayBase = positiveInteger(baseDelayMs, "render_retry_delay_invalid");
  const delayMax = positiveInteger(maxDelayMs, "render_retry_max_delay_invalid");
  const exponent = Math.max(0, job.attempt - 1);
  const delay = Math.min(delayMax, delayBase * (2 ** exponent));
  const retryAt = new Date(new Date(now).getTime() + delay).toISOString();
  const queued = transitionRenderJob(job, "queued", {now, reason: "retry_scheduled"});
  return withFingerprint({...queued, retryAt});
}

export function recordRenderArtifact({
  uri,
  mimeType = "video/mp4",
  sizeBytes,
  bytes = null,
  sha256 = null,
  width = null,
  height = null,
  durationSeconds = null,
  metadata = {},
}) {
  if (!String(uri || "").trim()) throw new Error("render_artifact_uri_required");
  const computedSha = bytes != null ? sha256Bytes(bytes) : normalizeSha256(sha256);
  const artifact = {
    uri: String(uri),
    mimeType: String(mimeType),
    sizeBytes: positiveInteger(sizeBytes, "render_artifact_size_invalid"),
    sha256: computedSha,
    width: width == null ? null : positiveInteger(width, "render_artifact_width_invalid"),
    height: height == null ? null : positiveInteger(height, "render_artifact_height_invalid"),
    durationSeconds: optionalPositiveNumber(durationSeconds, "render_artifact_duration_invalid"),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
  return {...artifact, artifactFingerprint: fingerprint(artifact)};
}
