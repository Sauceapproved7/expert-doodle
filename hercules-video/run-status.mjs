import {readLaunchRunState,validateLaunchRunState,verifyLaunchRunStateArtifacts} from "./launch-state.mjs";

function expectedFromState(state) {
  const identity=state?.identity || {};
  return {
    executionPlan:{fingerprint:String(identity.executionPlanFingerprint || "")},
    config:{
      upstreamCommit:String(identity.upstreamCommit || ""),
      checkpointSha256:String(identity.checkpointSha256 || ""),
      runtimeId:String(identity.runtimeId || ""),
      renderOutputDir:String(identity.renderOutputDir || ""),
      finalOutputPath:String(identity.finalOutputPath || ""),
      evidenceOutputPath:String(identity.evidenceOutputPath || ""),
    },
  };
}

export async function inspectLaunchRunState(state) {
  const expected=expectedFromState(state);
  let integrityError=null;
  try {
    validateLaunchRunState(state,expected);
    await verifyLaunchRunStateArtifacts(state);
  } catch (error) {
    integrityError=String(error?.message || error);
  }

  const jobs=Array.isArray(state?.session?.jobs) ? state.session.jobs : [];
  const evaluations=Array.isArray(state?.evaluations) ? state.evaluations : [];
  const evaluated=new Set(evaluations.map(item=>String(item?.shotId || "")));
  const integrityOk=integrityError===null;
  const shots=jobs.map((job,index)=>({
    order:index,
    shotId:String(job?.shotId || ""),
    status:String(job?.status || "unknown"),
    requestFingerprint:String(job?.requestFingerprint || ""),
    artifactSha256:job?.artifact?.sha256 ? String(job.artifact.sha256) : null,
    evaluationBound:evaluated.has(String(job?.shotId || "")),
    safelyReusable:integrityOk && job?.status==="completed",
    requiresResubmission:job?.status!=="completed",
  }));
  const completed=shots.filter(shot=>shot.status==="completed").length;
  const covered=shots.filter(shot=>shot.evaluationBound).length;
  return {
    schema:"sauceapproved.hercules.video-launch-run-status",
    version:1,
    readOnly:true,
    stateFingerprint:String(state?.fingerprint || ""),
    integrity:{ok:integrityOk,blockingError:integrityError},
    launchStage:String(state?.stage || "unknown"),
    identity:{
      executionPlanFingerprint:String(state?.identity?.executionPlanFingerprint || ""),
      upstreamCommit:String(state?.identity?.upstreamCommit || ""),
      checkpointSha256:String(state?.identity?.checkpointSha256 || ""),
      runtimeId:String(state?.identity?.runtimeId || ""),
      runnerId:String(state?.session?.runtime?.runnerId || ""),
      renderOutputDir:String(state?.identity?.renderOutputDir || ""),
      finalOutputPath:String(state?.identity?.finalOutputPath || ""),
      evidenceOutputPath:String(state?.identity?.evidenceOutputPath || ""),
    },
    shots,
    reusableShotIds:shots.filter(shot=>shot.safelyReusable).map(shot=>shot.shotId),
    resubmitShotIds:shots.filter(shot=>shot.requiresResubmission).map(shot=>shot.shotId),
    evaluationCoverage:{covered,total:shots.length,complete:shots.length>0 && covered===shots.length},
    finalization:{
      closed:state?.stage==="completed" && integrityOk && Boolean(state?.finalOutputSha256) && Boolean(state?.campaignEvidenceFingerprint),
      finalOutputSha256:state?.finalOutputSha256 || null,
      campaignEvidenceFingerprint:state?.campaignEvidenceFingerprint || null,
    },
    counts:{shots:shots.length,completed,evaluated:covered},
  };
}

export async function inspectLaunchRunStateFile(filePath) {
  return inspectLaunchRunState(await readLaunchRunState(filePath));
}
