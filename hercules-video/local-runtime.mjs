import {fingerprint} from "./core.mjs";
import {normalizeSha256} from "./render-bridge.mjs";
import {assertLocalVideoRunner} from "./local-runner.mjs";

function clone(value) {
  return structuredClone(value);
}

function nowIso(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("runtime_clock_invalid");
  return date.toISOString();
}

function verifyRequest(request) {
  if (!request || typeof request !== "object") throw new Error("runtime_request_required");
  const supplied = String(request.requestFingerprint || "");
  if (!supplied) throw new Error("runtime_request_fingerprint_required");
  const unsigned = {...request};
  delete unsigned.requestFingerprint;
  const expected = fingerprint(unsigned);
  if (expected !== supplied) throw new Error("runtime_request_fingerprint_mismatch");
  if (!String(request.projectId || "").trim()) throw new Error("runtime_project_id_required");
  if (!String(request.shot?.id || "").trim()) throw new Error("runtime_shot_id_required");
  if (!String(request.shot?.prompt || "").trim()) throw new Error("runtime_prompt_required");
  if (request.shot.prompt.length > 20000) throw new Error("runtime_prompt_too_large");
  return request;
}

function verifyEnvelope(envelope, runtimeId) {
  if (!envelope || typeof envelope !== "object") throw new Error("runtime_envelope_required");
  if (envelope.schema !== "sauceapproved.hercules.video-selfhosted-envelope") {
    throw new Error("runtime_envelope_schema_invalid");
  }
  if (Number(envelope.version) !== 1) throw new Error("runtime_envelope_version_invalid");
  if (String(envelope.runtimeId || "") !== runtimeId) throw new Error("runtime_id_mismatch");
  verifyRequest(envelope.request);
  return envelope;
}

function normalizeArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") throw new Error("runtime_artifact_required");
  const uri = String(artifact.uri || "").trim();
  if (!uri) throw new Error("runtime_artifact_uri_required");
  const sizeBytes = Number(artifact.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) throw new Error("runtime_artifact_size_invalid");
  return {
    ...artifact,
    uri,
    sizeBytes,
    sha256: normalizeSha256(artifact.sha256),
  };
}

export class HerculesLocalVideoRuntime {
  #jobs = new Map();
  #byRequest = new Map();

  constructor({
    runtimeId = "hercules-video-local",
    runner,
    clock = () => new Date(),
    maxJobs = 100,
  } = {}) {
    if (!String(runtimeId || "").trim()) throw new Error("runtime_id_required");
    assertLocalVideoRunner(runner);
    if (!Number.isInteger(maxJobs) || maxJobs <= 0) throw new Error("runtime_max_jobs_invalid");
    this.runtimeId = String(runtimeId);
    this.runner = runner;
    this.clock = clock;
    this.maxJobs = maxJobs;
  }

  async health({target} = {}) {
    this.#assertTarget(target);
    const runnerHealth = await this.runner.health();
    return {
      ok: runnerHealth?.ok === true,
      runtimeId: this.runtimeId,
      runner: this.runner.descriptor,
      jobs: this.#jobs.size,
      runnerHealth,
    };
  }

  async estimate({target, request}) {
    this.#assertTarget(target);
    const envelope = verifyEnvelope(request, this.runtimeId);
    return this.runner.estimate(clone(envelope.request));
  }

  async submit({target, request}) {
    this.#assertTarget(target);
    const envelope = verifyEnvelope(request, this.runtimeId);
    const requestFingerprint = envelope.request.requestFingerprint;

    const existingId = this.#byRequest.get(requestFingerprint);
    if (existingId) {
      const existing = this.#jobs.get(existingId);
      if (existing && ["queued", "running", "completed"].includes(existing.status)) {
        return {remoteJobId: existing.jobId, reused: true, status: existing.status};
      }
    }

    if (this.#jobs.size >= this.maxJobs) this.#evictOldestTerminal();
    if (this.#jobs.size >= this.maxJobs) throw new Error("runtime_capacity_reached");

    const submittedAt = nowIso(this.clock);
    const jobId = fingerprint({
      runtimeId: this.runtimeId,
      requestFingerprint,
      submittedAt,
      sequence: this.#jobs.size,
    }).slice(0, 32);

    const job = {
      jobId,
      requestFingerprint,
      status: "queued",
      submittedAt,
      startedAt: null,
      finishedAt: null,
      artifact: null,
      error: null,
      request: clone(envelope.request),
    };
    this.#jobs.set(jobId, job);
    this.#byRequest.set(requestFingerprint, jobId);

    queueMicrotask(() => {
      this.#execute(jobId).catch(() => {});
    });

    return {remoteJobId: jobId, reused: false, status: "queued"};
  }

  async status({target, remoteJobId}) {
    this.#assertTarget(target);
    return clone(this.#getJob(remoteJobId));
  }

  async inspect({target, asset}) {
    this.#assertTarget(target);
    const remoteJobId = String(asset?.remoteJobId || asset?.jobId || "");
    if (!remoteJobId) throw new Error("runtime_inspect_job_id_required");
    const job = this.#getJob(remoteJobId);
    return {
      jobId: job.jobId,
      status: job.status,
      artifact: job.artifact ? clone(job.artifact) : null,
      error: job.error ? clone(job.error) : null,
    };
  }

  async drain() {
    while ([...this.#jobs.values()].some(job => ["queued", "running"].includes(job.status))) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  #assertTarget(target) {
    if (!target || target.kind !== "self-hosted") throw new Error("runtime_self_hosted_target_required");
    if (String(target.runtimeId || "") !== this.runtimeId) throw new Error("runtime_target_mismatch");
  }

  #getJob(remoteJobId) {
    const id = String(remoteJobId || "");
    const job = this.#jobs.get(id);
    if (!job) throw new Error("runtime_job_not_found");
    return job;
  }

  async #execute(jobId) {
    const job = this.#getJob(jobId);
    if (job.status !== "queued") return;
    job.status = "running";
    job.startedAt = nowIso(this.clock);

    try {
      const result = await this.runner.render(clone(job.request));
      job.artifact = normalizeArtifact(result?.artifact);
      job.status = "completed";
      job.finishedAt = nowIso(this.clock);
    } catch (error) {
      job.status = "failed";
      job.finishedAt = nowIso(this.clock);
      job.error = {
        code: String(error?.code || "local_render_failed"),
        message: String(error?.message || error || "Local render failed"),
        retryable: error?.retryable === true,
      };
    }
  }

  #evictOldestTerminal() {
    const terminal = [...this.#jobs.values()]
      .filter(job => ["completed", "failed"].includes(job.status))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const oldest = terminal[0];
    if (!oldest) return;
    this.#jobs.delete(oldest.jobId);
    if (this.#byRequest.get(oldest.requestFingerprint) === oldest.jobId) {
      this.#byRequest.delete(oldest.requestFingerprint);
    }
  }
}
