import {isGitSha, isSha256, sha256Object} from "./hash.mjs";

export const TRAINING_CONTROL_VERSION = "0.1";
const IDENT = /^[a-z][a-z0-9-]{1,63}$/;
const TASKS = new Set([
  "general",
  "code",
  "vision",
  "speech-to-text",
  "text-to-speech",
  "research",
  "agent",
  "embedding",
  "rerank",
  "safety",
]);

function text(value) {
  return String(value ?? "").trim();
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeDatasetManifest(input = {}) {
  return {
    version: input.version ?? TRAINING_CONTROL_VERSION,
    id: text(input.id),
    description: text(input.description),
    sourceUri: text(input.sourceUri),
    sourceType: text(input.sourceType),
    contentSha256: text(input.contentSha256),
    recordCount: Number.isInteger(input.recordCount) ? input.recordCount : null,
    license: text(input.license),
    rightsBasis: text(input.rightsBasis),
    trainingAllowed: input.trainingAllowed === true,
    createdAt: text(input.createdAt),
    provenance: {
      origin: text(input.provenance?.origin),
      acquiredBy: text(input.provenance?.acquiredBy),
      sourceCommit: text(input.provenance?.sourceCommit),
      notes: text(input.provenance?.notes),
    },
  };
}

export function validateDatasetManifest(input) {
  const dataset = normalizeDatasetManifest(input);
  const errors = [];

  if (dataset.version !== TRAINING_CONTROL_VERSION) errors.push("unsupported dataset manifest version");
  if (!IDENT.test(dataset.id)) errors.push("invalid dataset id");
  if (!dataset.description) errors.push("dataset description is required");
  if (!dataset.sourceUri) errors.push("sourceUri is required");
  if (!dataset.sourceType) errors.push("sourceType is required");
  if (!isSha256(dataset.contentSha256)) errors.push("contentSha256 must be a lowercase SHA-256");
  if (!Number.isInteger(dataset.recordCount) || dataset.recordCount < 1) errors.push("recordCount must be a positive integer");
  if (!dataset.license || dataset.license.toLowerCase() === "unknown") errors.push("dataset license must be known");
  if (!dataset.rightsBasis) errors.push("rightsBasis is required");
  if (!dataset.trainingAllowed) errors.push("trainingAllowed must be explicitly true");
  if (!dataset.createdAt) errors.push("createdAt is required");
  if (!dataset.provenance.origin) errors.push("provenance.origin is required");
  if (!dataset.provenance.acquiredBy) errors.push("provenance.acquiredBy is required");
  if (!isGitSha(dataset.provenance.sourceCommit)) errors.push("provenance.sourceCommit must be a 40-character git SHA");

  return {
    ok: errors.length === 0,
    errors,
    dataset,
    fingerprint: errors.length === 0 ? sha256Object(dataset) : null,
  };
}

export function normalizeTrainingJob(input = {}) {
  return {
    version: input.version ?? TRAINING_CONTROL_VERSION,
    id: text(input.id),
    modelId: text(input.modelId),
    task: text(input.task),
    datasets: Array.isArray(input.datasets)
      ? input.datasets.map((item) => ({
          id: text(item?.id),
          contentSha256: text(item?.contentSha256),
          manifestFingerprint: text(item?.manifestFingerprint),
        }))
      : [],
    seed: Number.isInteger(input.seed) ? input.seed : null,
    codeCommit: text(input.codeCommit),
    trainer: {
      engine: text(input.trainer?.engine),
      version: text(input.trainer?.version),
      entrypoint: text(input.trainer?.entrypoint),
    },
    hyperparameters: input.hyperparameters && typeof input.hyperparameters === "object" && !Array.isArray(input.hyperparameters)
      ? structuredClone(input.hyperparameters)
      : {},
    createdAt: text(input.createdAt),
  };
}

export function validateTrainingJob(input) {
  const job = normalizeTrainingJob(input);
  const errors = [];

  if (job.version !== TRAINING_CONTROL_VERSION) errors.push("unsupported training job version");
  if (!IDENT.test(job.id)) errors.push("invalid training job id");
  if (!IDENT.test(job.modelId)) errors.push("invalid model id");
  if (!TASKS.has(job.task)) errors.push("unsupported training task");
  if (job.datasets.length === 0) errors.push("at least one dataset is required");
  for (const dataset of job.datasets) {
    if (!IDENT.test(dataset.id)) errors.push("invalid dataset reference id");
    if (!isSha256(dataset.contentSha256)) errors.push("dataset reference requires contentSha256");
    if (!isSha256(dataset.manifestFingerprint)) errors.push("dataset reference requires manifestFingerprint");
  }
  if (!Number.isInteger(job.seed) || job.seed < 0) errors.push("seed must be a non-negative integer");
  if (!isGitSha(job.codeCommit)) errors.push("codeCommit must be a 40-character git SHA");
  if (!job.trainer.engine) errors.push("trainer.engine is required");
  if (!job.trainer.version) errors.push("trainer.version is required");
  if (!job.trainer.entrypoint) errors.push("trainer.entrypoint is required");
  if (!job.createdAt) errors.push("createdAt is required");

  return {
    ok: errors.length === 0,
    errors,
    job,
    fingerprint: errors.length === 0 ? sha256Object(job) : null,
  };
}

export function normalizeCheckpoint(input = {}) {
  return {
    version: input.version ?? TRAINING_CONTROL_VERSION,
    id: text(input.id),
    modelId: text(input.modelId),
    jobId: text(input.jobId),
    jobFingerprint: text(input.jobFingerprint),
    artifactSha256: text(input.artifactSha256),
    bytes: Number.isInteger(input.bytes) ? input.bytes : null,
    format: text(input.format),
    framework: text(input.framework),
    parentCheckpointSha256: input.parentCheckpointSha256 == null ? null : text(input.parentCheckpointSha256),
    createdAt: text(input.createdAt),
    sourceCommit: text(input.sourceCommit),
  };
}

export function validateCheckpoint(input) {
  const checkpoint = normalizeCheckpoint(input);
  const errors = [];

  if (checkpoint.version !== TRAINING_CONTROL_VERSION) errors.push("unsupported checkpoint version");
  if (!IDENT.test(checkpoint.id)) errors.push("invalid checkpoint id");
  if (!IDENT.test(checkpoint.modelId)) errors.push("invalid model id");
  if (!IDENT.test(checkpoint.jobId)) errors.push("invalid job id");
  if (!isSha256(checkpoint.jobFingerprint)) errors.push("jobFingerprint must be a SHA-256");
  if (!isSha256(checkpoint.artifactSha256)) errors.push("artifactSha256 must be a SHA-256");
  if (!Number.isInteger(checkpoint.bytes) || checkpoint.bytes < 1) errors.push("bytes must be a positive integer");
  if (!checkpoint.format) errors.push("format is required");
  if (!checkpoint.framework) errors.push("framework is required");
  if (checkpoint.parentCheckpointSha256 && !isSha256(checkpoint.parentCheckpointSha256)) {
    errors.push("parentCheckpointSha256 must be null or a SHA-256");
  }
  if (!checkpoint.createdAt) errors.push("createdAt is required");
  if (!isGitSha(checkpoint.sourceCommit)) errors.push("sourceCommit must be a 40-character git SHA");

  return {
    ok: errors.length === 0,
    errors,
    checkpoint,
    fingerprint: errors.length === 0 ? sha256Object(checkpoint) : null,
  };
}

export function normalizeEvaluationSuite(input = {}) {
  return {
    version: input.version ?? TRAINING_CONTROL_VERSION,
    id: text(input.id),
    task: text(input.task),
    description: text(input.description),
    thresholds: Array.isArray(input.thresholds)
      ? input.thresholds.map((item) => ({
          metric: text(item?.metric),
          op: text(item?.op),
          value: Number(item?.value),
        }))
      : [],
    sourceCommit: text(input.sourceCommit),
  };
}

export function validateEvaluationSuite(input) {
  const suite = normalizeEvaluationSuite(input);
  const errors = [];

  if (suite.version !== TRAINING_CONTROL_VERSION) errors.push("unsupported evaluation suite version");
  if (!IDENT.test(suite.id)) errors.push("invalid evaluation suite id");
  if (!TASKS.has(suite.task)) errors.push("unsupported evaluation task");
  if (!suite.description) errors.push("evaluation description is required");
  if (suite.thresholds.length === 0) errors.push("at least one threshold is required");
  for (const threshold of suite.thresholds) {
    if (!IDENT.test(threshold.metric)) errors.push("invalid metric name");
    if (!["gte", "lte"].includes(threshold.op)) errors.push("threshold op must be gte or lte");
    if (!finiteNumber(threshold.value)) errors.push("threshold value must be finite");
  }
  if (!isGitSha(suite.sourceCommit)) errors.push("sourceCommit must be a 40-character git SHA");

  return {
    ok: errors.length === 0,
    errors,
    suite,
    fingerprint: errors.length === 0 ? sha256Object(suite) : null,
  };
}

export function normalizeEvaluationResult(input = {}) {
  return {
    version: input.version ?? TRAINING_CONTROL_VERSION,
    id: text(input.id),
    suiteId: text(input.suiteId),
    suiteFingerprint: text(input.suiteFingerprint),
    checkpointSha256: text(input.checkpointSha256),
    metrics: input.metrics && typeof input.metrics === "object" && !Array.isArray(input.metrics)
      ? structuredClone(input.metrics)
      : {},
    evidenceSha256: text(input.evidenceSha256),
    createdAt: text(input.createdAt),
  };
}

export function validateEvaluationResult(input) {
  const result = normalizeEvaluationResult(input);
  const errors = [];

  if (result.version !== TRAINING_CONTROL_VERSION) errors.push("unsupported evaluation result version");
  if (!IDENT.test(result.id)) errors.push("invalid evaluation result id");
  if (!IDENT.test(result.suiteId)) errors.push("invalid suite id");
  if (!isSha256(result.suiteFingerprint)) errors.push("suiteFingerprint must be a SHA-256");
  if (!isSha256(result.checkpointSha256)) errors.push("checkpointSha256 must be a SHA-256");
  if (!isSha256(result.evidenceSha256)) errors.push("evidenceSha256 must be a SHA-256");
  if (!result.createdAt) errors.push("createdAt is required");
  for (const [name, value] of Object.entries(result.metrics)) {
    if (!IDENT.test(name)) errors.push("invalid metric name: " + name);
    if (!finiteNumber(value)) errors.push("metric must be finite: " + name);
  }

  return {
    ok: errors.length === 0,
    errors,
    result,
    fingerprint: errors.length === 0 ? sha256Object(result) : null,
  };
}
