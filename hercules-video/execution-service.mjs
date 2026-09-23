import {fingerprint} from "./core.mjs";
import {
  validateCampaignExecutionPlan,
  collectCampaignWinners,
  createCampaignAssemblyPlan,
  createCampaignEvidencePackage,
} from "./campaign-coordinator.mjs";

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("execution_invalid_time");
  return date.toISOString();
}

function createJournal(executionPlanFingerprint) {
  return {
    schema:"sauceapproved.hercules.video-execution-journal",
    version:1,
    executionPlanFingerprint,
    entries:[],
    head:null,
  };
}

function appendJournal(journal,event,at,payload={}) {
  const entryBase={
    index:journal.entries.length,
    at,
    event:String(event),
    payload,
    previous:journal.head,
  };
  const entry={...entryBase,fingerprint:fingerprint(entryBase)};
  journal.entries.push(entry);
  journal.head=entry.fingerprint;
  return entry;
}

function requireAdapter(adapters,providerId) {
  const adapter=adapters?.[providerId];
  if (!adapter) throw new Error("execution_adapter_missing:" + providerId);
  for (const method of ["health","generate","status","inspect"]) {
    if (typeof adapter[method]!=="function") throw new Error("execution_adapter_invalid:" + providerId + ":" + method);
  }
  return adapter;
}

function validateQuality(quality,shotId) {
  if (!quality || typeof quality!=="object") throw new Error("execution_quality_required:" + shotId);
  return quality;
}

async function sleepDefault(ms) {
  await new Promise(resolve=>setTimeout(resolve,ms));
}

async function waitForTerminal({
  adapter,
  remoteJobId,
  pollIntervalMs,
  maxPolls,
  sleep,
  onPoll,
}) {
  for (let poll=0; poll<maxPolls; poll++) {
    const status=await adapter.status(remoteJobId);
    onPoll?.(status,poll);
    if (status?.status==="completed") return status;
    if (status?.status==="failed") {
      const error=new Error("execution_render_failed:" + remoteJobId);
      error.status=status;
      throw error;
    }
    if (!["queued","running"].includes(status?.status)) {
      throw new Error("execution_render_status_invalid:" + remoteJobId);
    }
    if (poll < maxPolls - 1) await sleep(pollIntervalMs);
  }
  throw new Error("execution_render_poll_limit:" + remoteJobId);
}

export async function executeCampaignPlan({
  executionPlan,
  adapters,
  qualityEvaluator,
  audioTracks=[],
  assemblyExecutor,
  assemblyPolicy={},
  minimumScore=0.78,
  pollIntervalMs=1000,
  maxPolls=1200,
  sleep=sleepDefault,
  clock=()=>new Date(),
}) {
  validateCampaignExecutionPlan(executionPlan);
  if (typeof qualityEvaluator!=="function") throw new Error("execution_quality_evaluator_required");
  if (typeof assemblyExecutor!=="function") throw new Error("execution_assembly_executor_required");
  if (!Number.isInteger(maxPolls) || maxPolls<=0) throw new Error("execution_max_polls_invalid");
  if (!Number.isFinite(Number(pollIntervalMs)) || Number(pollIntervalMs)<0) throw new Error("execution_poll_interval_invalid");

  const journal=createJournal(executionPlan.fingerprint);
  appendJournal(journal,"execution_started",iso(clock()),{
    projectId:executionPlan.projectId,
    storyboardFingerprint:executionPlan.storyboard.fingerprint,
  });

  const healthByProvider=new Map();
  const rounds=[];

  for (const tournament of executionPlan.tournamentPlan) {
    if (tournament.status!=="ready") throw new Error("execution_tournament_not_ready:" + tournament.shotId);
    const shot=executionPlan.storyboard.shots.find(item=>item.id===tournament.shotId);
    const request=executionPlan.renderRequests.find(item=>item.shot.id===tournament.shotId);
    if (!shot || !request) throw new Error("execution_shot_request_missing:" + tournament.shotId);

    const renders=[];
    for (const entrant of tournament.entrants) {
      const providerId=String(entrant.providerId || "");
      const adapter=requireAdapter(adapters,providerId);

      if (!healthByProvider.has(providerId)) {
        const health=await adapter.health();
        if (health?.ok!==true) throw new Error("execution_adapter_unhealthy:" + providerId);
        healthByProvider.set(providerId,health);
        appendJournal(journal,"adapter_healthy",iso(clock()),{providerId});
      }

      appendJournal(journal,"render_submitting",iso(clock()),{
        shotId:shot.id,
        providerId,
        requestFingerprint:request.requestFingerprint,
      });

      const submitted=await adapter.generate(request);
      const remoteJobId=String(submitted?.remoteJobId || "");
      if (!remoteJobId) throw new Error("execution_remote_job_id_required:" + shot.id + ":" + providerId);

      appendJournal(journal,"render_submitted",iso(clock()),{
        shotId:shot.id,
        providerId,
        remoteJobId,
      });

      const terminal=await waitForTerminal({
        adapter,
        remoteJobId,
        pollIntervalMs:Number(pollIntervalMs),
        maxPolls,
        sleep,
        onPoll:(status,poll)=>{
          appendJournal(journal,"render_polled",iso(clock()),{
            shotId:shot.id,
            providerId,
            remoteJobId,
            poll,
            status:status?.status || null,
          });
        },
      });

      const inspection=await adapter.inspect({remoteJobId});
      const artifact=inspection?.artifact || terminal?.artifact;
      if (!artifact) throw new Error("execution_artifact_missing:" + shot.id + ":" + providerId);

      const quality=validateQuality(await qualityEvaluator({
        shot,
        request,
        providerId,
        artifact,
        terminal,
        inspection,
      }),shot.id);

      const render={
        id:remoteJobId,
        providerId,
        quality,
        artifact,
      };
      renders.push(render);
      appendJournal(journal,"render_evaluated",iso(clock()),{
        shotId:shot.id,
        providerId,
        remoteJobId,
        artifactSha256:artifact.sha256 || null,
        qualityFingerprint:fingerprint(quality),
      });
    }

    rounds.push({shotId:shot.id,renders});
  }

  const winners=collectCampaignWinners(executionPlan,rounds,minimumScore);
  appendJournal(journal,"tournament_resolved",iso(clock()),{
    winnersFingerprint:winners.fingerprint,
    shotIds:winners.winners.map(winner=>winner.shotId),
  });

  const assemblyPlan=createCampaignAssemblyPlan({
    executionPlan,
    winners,
    audioTracks,
    assemblyPolicy,
  });
  appendJournal(journal,"assembly_planned",iso(clock()),{
    assemblyPlanFingerprint:assemblyPlan.fingerprint,
  });

  const assemblyResult=await assemblyExecutor(assemblyPlan);
  const assemblyEvidence=assemblyResult?.evidence;
  if (!assemblyEvidence || assemblyEvidence.planFingerprint!==assemblyPlan.fingerprint) {
    throw new Error("execution_assembly_evidence_invalid");
  }

  appendJournal(journal,"assembly_completed",iso(clock()),{
    assemblyEvidenceFingerprint:assemblyEvidence.fingerprint,
    finalSha256:assemblyEvidence.output?.sha256 || null,
  });

  const evidence=createCampaignEvidencePackage({
    executionPlan,
    winners,
    assemblyPlan,
    assemblyEvidence,
  });

  appendJournal(journal,"execution_completed",iso(clock()),{
    campaignEvidenceFingerprint:evidence.fingerprint,
    finalSha256:evidence.finalOutput?.sha256 || null,
  });

  const journalUnsigned={
    schema:journal.schema,
    version:journal.version,
    executionPlanFingerprint:journal.executionPlanFingerprint,
    entries:journal.entries,
    head:journal.head,
  };

  return {
    status:"completed",
    executionPlan,
    winners,
    assemblyPlan,
    assemblyEvidence,
    campaignEvidence:evidence,
    journal:{...journalUnsigned,fingerprint:fingerprint(journalUnsigned)},
  };
}

export function verifyExecutionJournal(journal) {
  if (!journal || typeof journal!=="object") throw new Error("execution_journal_required");
  let previous=null;
  for (let index=0; index<(journal.entries||[]).length; index++) {
    const entry=journal.entries[index];
    if (entry.index!==index) throw new Error("execution_journal_index_invalid:" + index);
    if (entry.previous!==previous) throw new Error("execution_journal_chain_invalid:" + index);
    const unsigned={
      index:entry.index,
      at:entry.at,
      event:entry.event,
      payload:entry.payload,
      previous:entry.previous,
    };
    if (fingerprint(unsigned)!==entry.fingerprint) throw new Error("execution_journal_entry_tampered:" + index);
    previous=entry.fingerprint;
  }
  if (journal.head!==previous) throw new Error("execution_journal_head_invalid");
  const unsigned={
    schema:journal.schema,
    version:journal.version,
    executionPlanFingerprint:journal.executionPlanFingerprint,
    entries:journal.entries,
    head:journal.head,
  };
  if (journal.fingerprint && fingerprint(unsigned)!==journal.fingerprint) {
    throw new Error("execution_journal_fingerprint_invalid");
  }
  return true;
}
