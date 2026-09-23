import {fingerprint, routeShot} from "./core.mjs";
import {compileStoryboard, buildTournamentPlan, resolveTournament} from "./storyboard.mjs";
import {createRenderRequest} from "./render-bridge.mjs";
import {createAssemblyPlan, buildCaptionTimelineFromStoryboard} from "./assembly-core.mjs";

function selfHostedOnly(providers) {
  return (providers || []).filter(provider => provider?.kind === "self-hosted" || provider?.deployment === "self-hosted");
}

function normalizeRenderArtifact(render, shot) {
  const artifact = render?.artifact;
  if (!artifact || typeof artifact !== "object") throw new Error("campaign_render_artifact_required:" + shot.id);
  const uri = String(artifact.uri || "");
  const sha256 = String(artifact.sha256 || "").toLowerCase();
  const durationSeconds = Number(artifact.durationSeconds ?? shot.durationSeconds);
  if (!uri.startsWith("file://")) throw new Error("campaign_render_local_uri_required:" + shot.id);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("campaign_render_sha256_invalid:" + shot.id);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("campaign_render_duration_invalid:" + shot.id);
  return {uri,sha256,durationSeconds};
}

export function createCampaignExecutionPlan({
  projectId,
  brief,
  providers,
  resolution="720p",
  fps=24,
  modelRef=null,
  candidatesPerShot=2,
  maxCredits=Infinity,
}) {
  if (!String(projectId || "").trim()) throw new Error("campaign_project_id_required");
  const storyboard=compileStoryboard(brief);
  const localProviders=selfHostedOnly(providers);
  if (!localProviders.length) throw new Error("campaign_self_hosted_provider_required");

  const routes=storyboard.shots.map(shot=>routeShot(shot,localProviders,{maxCredits}));
  const blocked=routes.filter(route=>route.status!=="routed");
  if (blocked.length) {
    const error=new Error("campaign_route_blocked");
    error.blocked=blocked;
    throw error;
  }

  const renderRequests=storyboard.shots.map(shot=>createRenderRequest({
    projectId,
    shot,
    resolution,
    fps,
    modelRef,
  }));

  const tournamentPlan=buildTournamentPlan({storyboard,routes,candidatesPerShot});
  const unsigned={
    schema:"sauceapproved.hercules.video-campaign-execution-plan",
    version:1,
    projectId:String(projectId),
    storyboard,
    routes,
    renderRequests,
    tournamentPlan,
    policy:{
      selfHostedOnly:true,
      commercialFallback:false,
      candidatesPerShot:Number(candidatesPerShot),
      maxCredits:Number.isFinite(Number(maxCredits)) ? Number(maxCredits) : null,
    },
  };
  return {...unsigned,fingerprint:fingerprint(unsigned)};
}

export function validateCampaignExecutionPlan(plan) {
  if (!plan || typeof plan!=="object") throw new Error("campaign_plan_required");
  const supplied=String(plan.fingerprint||"");
  const unsigned={...plan};
  delete unsigned.fingerprint;
  if (!supplied || fingerprint(unsigned)!==supplied) throw new Error("campaign_plan_fingerprint_mismatch");
  return plan;
}

export function collectCampaignWinners(plan, rounds, minimumScore=0.78) {
  validateCampaignExecutionPlan(plan);
  const resolved=resolveTournament(rounds,minimumScore);
  const byShot=new Map(resolved.map(result=>[result.shotId,result]));
  const winners=[];

  for (const shot of plan.storyboard.shots) {
    const result=byShot.get(shot.id);
    if (!result) throw new Error("campaign_missing_tournament_result:" + shot.id);
    if (result.status!=="winner_selected") {
      const error=new Error("campaign_winner_unavailable:" + shot.id);
      error.result=result;
      throw error;
    }
    const artifact=normalizeRenderArtifact(result.winner,shot);
    winners.push({
      shotId:shot.id,
      renderId:String(result.winner.id),
      providerId:String(result.winner.providerId || ""),
      score:result.winner.evaluation.score,
      artifact,
    });
  }

  const unsigned={
    schema:"sauceapproved.hercules.video-campaign-winners",
    version:1,
    executionPlanFingerprint:plan.fingerprint,
    winners,
  };
  return {...unsigned,fingerprint:fingerprint(unsigned)};
}

function validatePostAudioForStoryboard(storyboard,audioTracks) {
  const requiresPost=storyboard.shots.some(shot=>shot.requiresAudio && shot.audioStrategy==="post");
  if (requiresPost && (!Array.isArray(audioTracks) || audioTracks.length===0)) {
    throw new Error("campaign_post_audio_evidence_required");
  }
}

export function createCampaignAssemblyPlan({
  executionPlan,
  winners,
  audioTracks=[],
  assemblyPolicy={},
}) {
  validateCampaignExecutionPlan(executionPlan);
  if (!winners || winners.executionPlanFingerprint!==executionPlan.fingerprint) {
    throw new Error("campaign_winners_plan_mismatch");
  }

  const winnerMap=new Map((winners.winners||[]).map(winner=>[winner.shotId,winner]));
  const clips=executionPlan.storyboard.shots.map(shot=>{
    const winner=winnerMap.get(shot.id);
    if (!winner) throw new Error("campaign_missing_winner:" + shot.id);
    return {
      shotId:shot.id,
      uri:winner.artifact.uri,
      durationSeconds:winner.artifact.durationSeconds,
      sha256:winner.artifact.sha256,
    };
  });

  validatePostAudioForStoryboard(executionPlan.storyboard,audioTracks);
  return createAssemblyPlan({
    projectId:executionPlan.projectId,
    clips,
    audioTracks,
    captions:buildCaptionTimelineFromStoryboard(executionPlan.storyboard),
    policy:assemblyPolicy,
  });
}

export function createCampaignEvidencePackage({
  executionPlan,
  winners,
  assemblyPlan,
  assemblyEvidence,
}) {
  validateCampaignExecutionPlan(executionPlan);
  if (winners?.executionPlanFingerprint!==executionPlan.fingerprint) throw new Error("campaign_evidence_winner_link_invalid");
  if (assemblyEvidence?.planFingerprint!==assemblyPlan?.fingerprint) throw new Error("campaign_evidence_assembly_link_invalid");

  const unsigned={
    schema:"sauceapproved.hercules.video-campaign-evidence",
    version:1,
    executionPlanFingerprint:executionPlan.fingerprint,
    storyboardFingerprint:executionPlan.storyboard.fingerprint,
    winnersFingerprint:winners.fingerprint,
    assemblyPlanFingerprint:assemblyPlan.fingerprint,
    assemblyEvidenceFingerprint:assemblyEvidence.fingerprint,
    finalOutput:assemblyEvidence.output,
  };
  return {...unsigned,fingerprint:fingerprint(unsigned)};
}
