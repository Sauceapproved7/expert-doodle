import {fingerprint} from "./core.mjs";
import {assertAdapterBoundary} from "./adapter.mjs";
import {
  validateCampaignExecutionPlan,
  collectCampaignWinners,
  createCampaignAssemblyPlan,
  createCampaignEvidencePackage,
} from "./campaign-coordinator.mjs";

const REMOTE_STATES = new Set(["queued", "running", "completed", "failed"]);

function clone(value) {
  return structuredClone(value);
}

function nowIso(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("campaign_execution_clock_invalid");
  return date.toISOString();
}

function seal(session) {
  const unsigned = {...session};
  delete unsigned.fingerprint;
  return {...unsigned, fingerprint:fingerprint(unsigned)};
}

function normalizeArtifact(artifact, shotId) {
  if (!artifact || typeof artifact !== "object") {
    throw new Error("campaign_execution_artifact_required:" + shotId);
  }
  const uri = String(artifact.uri || "");
  const sha256 = String(artifact.sha256 || "").toLowerCase();
  const sizeBytes = Number(artifact.sizeBytes);
  if (!uri.startsWith("file://")) throw new Error("campaign_execution_local_artifact_required:" + shotId);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("campaign_execution_artifact_sha256_invalid:" + shotId);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("campaign_execution_artifact_size_invalid:" + shotId);
  }
  return {
    ...clone(artifact),
    uri,
    sha256,
    sizeBytes,
  };
}

function normalizeRemoteError(error) {
  if (!error || typeof error !== "object") {
    return {code:"campaign_render_failed", message:String(error || "Render failed"), retryable:false};
  }
  return {
    code:String(error.code || "campaign_render_failed"),
    message:String(error.message || "Render failed"),
    retryable:error.retryable === true,
  };
}

export function validateCampaignExecutionSession(session) {
  if (!session || typeof session !== "object") throw new Error("campaign_execution_session_required");
  const supplied = String(session.fingerprint || "");
  const unsigned = {...session};
  delete unsigned.fingerprint;
  if (!supplied || fingerprint(unsigned) !== supplied) {
    throw new Error("campaign_execution_session_fingerprint_mismatch");
  }
  return session;
}

function assertSessionPlan(session, executionPlan) {
  validateCampaignExecutionSession(session);
  validateCampaignExecutionPlan(executionPlan);
  if (session.executionPlanFingerprint !== executionPlan.fingerprint) {
    throw new Error("campaign_execution_plan_mismatch");
  }
}

function addEvent(session, event, at) {
  session.updatedAt = at;
  session.events = [...(session.events || []), {at, ...event}];
}

function setPhase(session, phase, at) {
  if (session.phase === phase) return;
  const previous = session.phase;
  session.phase = phase;
  addEvent(session, {type:"phase", from:previous, to:phase}, at);
}

export class HerculesCampaignExecutionService {
  constructor({
    adapter,
    clock = () => new Date(),
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  } = {}) {
    assertAdapterBoundary(adapter);
    if (typeof adapter.status !== "function") throw new Error("campaign_execution_adapter_status_required");
    if (typeof clock !== "function") throw new Error("campaign_execution_clock_required");
    if (typeof sleep !== "function") throw new Error("campaign_execution_sleep_required");
    this.adapter = adapter;
    this.clock = clock;
    this.sleep = sleep;
  }

  async start(executionPlan) {
    validateCampaignExecutionPlan(executionPlan);
    const health = await this.adapter.health();
    if (health?.ok !== true) {
      const error = new Error("campaign_execution_runtime_unhealthy");
      error.health = health;
      throw error;
    }

    const createdAt = nowIso(this.clock);
    const session = {
      schema:"sauceapproved.hercules.video-campaign-execution-session",
      version:1,
      executionPlanFingerprint:executionPlan.fingerprint,
      phase:"submitting",
      createdAt,
      updatedAt:createdAt,
      runtime:{
        healthy:true,
        runtimeId:health.runtimeId || this.adapter.descriptor?.runtimeId || null,
        runnerId:health.runner?.id || health.runnerHealth?.runnerId || null,
      },
      jobs:executionPlan.renderRequests.map(request => ({
        shotId:request.shot.id,
        requestFingerprint:request.requestFingerprint,
        remoteJobId:null,
        status:"pending",
        artifact:null,
        error:null,
      })),
      events:[{at:createdAt,type:"phase",from:null,to:"submitting"}],
      error:null,
    };

    for (let index=0; index<executionPlan.renderRequests.length; index += 1) {
      const request = executionPlan.renderRequests[index];
      const job = session.jobs[index];
      try {
        const estimate = await this.adapter.estimate(request);
        if (estimate?.supported === false) {
          throw new Error("campaign_execution_request_unsupported:" + request.shot.id);
        }
        const submitted = await this.adapter.generate(request);
        const remoteJobId = String(submitted?.remoteJobId || "");
        const status = String(submitted?.status || "queued");
        if (!remoteJobId) throw new Error("campaign_execution_remote_job_id_required:" + request.shot.id);
        if (!REMOTE_STATES.has(status)) throw new Error("campaign_execution_remote_status_invalid:" + request.shot.id);
        job.remoteJobId = remoteJobId;
        job.status = status;
        const at = nowIso(this.clock);
        addEvent(session, {
          type:"render_submitted",
          shotId:job.shotId,
          remoteJobId,
          status,
          reused:submitted?.reused === true,
        }, at);
      } catch (cause) {
        const at = nowIso(this.clock);
        job.status = "failed";
        job.error = normalizeRemoteError(cause);
        session.error = {code:"campaign_execution_submit_failed", shotId:job.shotId, cause:job.error};
        setPhase(session, "failed", at);
        const sealed = seal(session);
        const error = new Error("campaign_execution_submit_failed:" + job.shotId);
        error.session = sealed;
        error.cause = cause;
        throw error;
      }
    }

    setPhase(session, session.jobs.every(job => job.status === "completed" && job.artifact) ? "renders_completed" : "rendering", nowIso(this.clock));
    return seal(session);
  }

  async refresh(executionPlan, inputSession) {
    assertSessionPlan(inputSession, executionPlan);
    const session = clone(inputSession);
    if (["completed", "failed"].includes(session.phase)) return session;

    for (const job of session.jobs) {
      if (!job.remoteJobId || job.status === "failed" || (job.status === "completed" && job.artifact)) continue;
      const remote = await this.adapter.status(job.remoteJobId);
      const status = String(remote?.status || "");
      if (!REMOTE_STATES.has(status)) throw new Error("campaign_execution_remote_status_invalid:" + job.shotId);
      const previous = job.status;
      job.status = status;
      if (status === "completed") {
        job.artifact = normalizeArtifact(remote.artifact, job.shotId);
        job.error = null;
      } else if (status === "failed") {
        job.error = normalizeRemoteError(remote.error);
      }
      if (previous !== status) {
        addEvent(session, {
          type:"render_status",
          shotId:job.shotId,
          remoteJobId:job.remoteJobId,
          from:previous,
          to:status,
        }, nowIso(this.clock));
      }
    }

    const at = nowIso(this.clock);
    if (session.jobs.some(job => job.status === "failed")) {
      session.error = {
        code:"campaign_execution_render_failed",
        failedShots:session.jobs.filter(job => job.status === "failed").map(job => job.shotId),
      };
      setPhase(session, "failed", at);
    } else if (session.jobs.every(job => job.status === "completed")) {
      setPhase(session, "renders_completed", at);
    } else {
      setPhase(session, "rendering", at);
    }
    return seal(session);
  }

  async awaitRenders(executionPlan, inputSession, {
    maxPolls = 120,
    pollIntervalMs = 250,
  } = {}) {
    if (!Number.isInteger(maxPolls) || maxPolls <= 0) throw new Error("campaign_execution_max_polls_invalid");
    if (!Number.isFinite(Number(pollIntervalMs)) || Number(pollIntervalMs) < 0) {
      throw new Error("campaign_execution_poll_interval_invalid");
    }

    let session = inputSession;
    for (let poll=0; poll<maxPolls; poll += 1) {
      session = await this.refresh(executionPlan, session);
      if (session.phase === "renders_completed") return session;
      if (session.phase === "failed") {
        const error = new Error("campaign_execution_failed");
        error.session = session;
        throw error;
      }
      if (poll + 1 < maxPolls) await this.sleep(Number(pollIntervalMs));
    }

    const error = new Error("campaign_execution_poll_limit");
    error.session = session;
    throw error;
  }

  async buildEvaluatedRounds(executionPlan, session, evaluate) {
    assertSessionPlan(session, executionPlan);
    if (session.phase !== "renders_completed") throw new Error("campaign_execution_renders_incomplete");
    if (typeof evaluate !== "function") throw new Error("campaign_execution_evaluator_required");

    const jobs = new Map(session.jobs.map(job => [job.shotId, job]));
    const routes = new Map(executionPlan.routes.map(route => [route.shotId, route]));
    const requests = new Map(executionPlan.renderRequests.map(request => [request.shot.id, request]));
    const rounds = [];

    for (const shot of executionPlan.storyboard.shots) {
      const job = jobs.get(shot.id);
      if (!job?.artifact) throw new Error("campaign_execution_artifact_required:" + shot.id);
      const route = routes.get(shot.id);
      if (!route || route.status !== "routed") throw new Error("campaign_execution_route_missing:" + shot.id);
      const quality = await evaluate({
        shot:clone(shot),
        request:clone(requests.get(shot.id)),
        artifact:clone(job.artifact),
        route:clone(route),
      });
      rounds.push({
        shotId:shot.id,
        renders:[{
          id:job.remoteJobId,
          providerId:String(route.selected?.providerId || ""),
          artifact:clone(job.artifact),
          quality:clone(quality),
        }],
      });
    }
    return rounds;
  }

  async finalize({
    executionPlan,
    session:inputSession,
    evaluate,
    audioTracks=[],
    assemblyPolicy={},
    assemblyRunner,
    outputPath,
    minimumScore=0.78,
  }) {
    assertSessionPlan(inputSession, executionPlan);
    if (inputSession.phase !== "renders_completed") throw new Error("campaign_execution_renders_incomplete");
    if (typeof assemblyRunner !== "function") throw new Error("campaign_execution_assembly_runner_required");

    let session = clone(inputSession);
    try {
      const rounds = await this.buildEvaluatedRounds(executionPlan, inputSession, evaluate);
      setPhase(session, "evaluating", nowIso(this.clock));
      const winners = collectCampaignWinners(executionPlan, rounds, minimumScore);
      session.winnersFingerprint = winners.fingerprint;
      addEvent(session, {type:"winners_collected", fingerprint:winners.fingerprint}, nowIso(this.clock));

      const assemblyPlan = createCampaignAssemblyPlan({
        executionPlan,
        winners,
        audioTracks,
        assemblyPolicy,
      });
      session.assemblyPlanFingerprint = assemblyPlan.fingerprint;
      setPhase(session, "assembling", nowIso(this.clock));
      addEvent(session, {type:"assembly_planned", fingerprint:assemblyPlan.fingerprint}, nowIso(this.clock));

      const assemblyResult = await assemblyRunner(assemblyPlan, {outputPath});
      const assemblyEvidence = assemblyResult?.evidence;
      if (!assemblyEvidence) throw new Error("campaign_execution_assembly_evidence_required");

      const campaignEvidence = createCampaignEvidencePackage({
        executionPlan,
        winners,
        assemblyPlan,
        assemblyEvidence,
      });
      session.assemblyEvidenceFingerprint = assemblyEvidence.fingerprint;
      session.campaignEvidenceFingerprint = campaignEvidence.fingerprint;
      session.finalOutput = clone(campaignEvidence.finalOutput);
      session.error = null;
      setPhase(session, "completed", nowIso(this.clock));
      addEvent(session, {type:"campaign_evidence", fingerprint:campaignEvidence.fingerprint}, nowIso(this.clock));

      return {
        session:seal(session),
        rounds,
        winners,
        assemblyPlan,
        assemblyResult,
        campaignEvidence,
      };
    } catch (cause) {
      const at = nowIso(this.clock);
      session.error = {
        code:String(cause?.code || "campaign_execution_finalize_failed"),
        message:String(cause?.message || cause || "Campaign finalization failed"),
      };
      setPhase(session, "failed", at);
      const error = new Error("campaign_execution_finalize_failed");
      error.session = seal(session);
      error.cause = cause;
      throw error;
    }
  }
}
