const surface=(id,label)=>Object.freeze({id,label,implementationOwner:"SauceApproved enterprise LLC",herculesOwned:true,outsidePlatformAllowed:false});
const SURFACES=Object.freeze([
  surface("dashboard","Dashboard"),
  surface("project-brief","Project Brief"),
  surface("storyboard","Storyboard"),
  surface("run-status","Run Status"),
  surface("shot-timeline","Shot Timeline"),
  surface("quality-evidence","Quality & Evidence"),
  surface("recovery","Recovery"),
  surface("output-review","Output Review"),
  surface("content-multiplier","Content Multiplier"),
  surface("ai-sales-agent","AI Sales Agent"),
  surface("brand-brain","Brand Brain"),
  surface("campaign-forge","Campaign Forge"),
  surface("movie-machine","Movie Machine"),
  surface("holostage","HoloStage"),
  surface("legacy-vault","Legacy Vault"),
  surface("studio-director","Studio Director"),
  surface("reality-forge","Reality Forge"),
  surface("performance-lab","Performance Lab"),
  surface("scene-forge","SceneForge"),
  surface("sound-world","SoundWorld"),
  surface("actor-lab","Actor Lab"),
  surface("market","Studios Market"),
  surface("vintage-camera","Vintage Camera"),
  surface("kids","Kids Studio"),
  surface("integrations","Integrations"),
  surface("creation-floor","Creation Floor")
]);

function disabled(reason) {
  return Object.freeze({enabled:false,reason});
}

function enabled() {
  return Object.freeze({enabled:true,reason:null});
}

function cloneShot(shot) {
  return Object.freeze({
    order:Number(shot?.order ?? 0),
    shotId:String(shot?.shotId || ""),
    status:String(shot?.status || "unknown"),
    requestFingerprint:String(shot?.requestFingerprint || ""),
    artifactSha256:shot?.artifactSha256 ? String(shot.artifactSha256) : null,
    evaluationBound:shot?.evaluationBound===true,
    safelyReusable:shot?.safelyReusable===true,
    requiresResubmission:shot?.requiresResubmission===true
  });
}

export function createStudioManifest() {
  return Object.freeze({
    schema:"sauceapproved.hercules.video-studio-manifest",
    version:1,
    product:"SauceApproved Studio",
    implementationOwner:"SauceApproved enterprise LLC",
    buildMode:"hercules-owned",
    externalPlatforms:Object.freeze([]),
    thirdPartyHostedRuntimeAllowed:false,
    thirdPartyProductSubstitutionAllowed:false,
    standardsPolicy:"interoperate-with-open-or-device-standards-without-outsourcing-the-product",
    engine:"Hercules Video",
    executionPolicy:"fail-closed",
    surfaces:SURFACES
  });
}

export function buildStudioViewModel({runStatus,executionBridge={}}={}) {
  if (!runStatus || typeof runStatus!=="object") throw new Error("studio_run_status_required");

  const integrityOk=runStatus?.integrity?.ok===true;
  const integrityError=integrityOk ? null : String(runStatus?.integrity?.blockingError || "run_integrity_unverified");
  const bridgeConnected=executionBridge?.connected===true;
  const bridgeReason=String(executionBridge?.reason || "execution_bridge_unavailable");
  const stage=String(runStatus?.launchStage || "unknown");
  const timeline=Object.freeze((Array.isArray(runStatus?.shots) ? runStatus.shots : []).map(cloneShot));
  const reusableShotIds=Object.freeze((Array.isArray(runStatus?.reusableShotIds) ? runStatus.reusableShotIds : []).map(String));
  const resubmitShotIds=Object.freeze((Array.isArray(runStatus?.resubmitShotIds) ? runStatus.resubmitShotIds : []).map(String));
  const finalClosed=runStatus?.finalization?.closed===true;

  let mode="read-only";
  if (!integrityOk) mode="blocked";
  else if (bridgeConnected) mode="operator";

  const executionBlock=!integrityOk ? integrityError : (!bridgeConnected ? bridgeReason : null);
  const canExecute=integrityOk && bridgeConnected;
  const canResume=canExecute && stage!=="completed";
  const canExport=integrityOk && finalClosed;

  return Object.freeze({
    schema:"sauceapproved.hercules.video-studio-view",
    version:1,
    product:"SauceApproved Studio",
    engine:"Hercules Video",
    mode,
    executionPolicy:"fail-closed",
    blockingReason:!integrityOk ? integrityError : null,
    stateFingerprint:String(runStatus?.stateFingerprint || ""),
    launchStage:stage,
    integrity:Object.freeze({
      ok:integrityOk,
      blockingError:integrityError
    }),
    integration:Object.freeze({
      executionConnected:bridgeConnected,
      executionBridgeId:bridgeConnected ? String(executionBridge?.id || "trusted-bridge") : null,
      reason:bridgeConnected ? null : bridgeReason
    }),
    identity:Object.freeze({
      executionPlanFingerprint:String(runStatus?.identity?.executionPlanFingerprint || ""),
      upstreamCommit:String(runStatus?.identity?.upstreamCommit || ""),
      checkpointSha256:String(runStatus?.identity?.checkpointSha256 || ""),
      runtimeId:String(runStatus?.identity?.runtimeId || ""),
      runnerId:String(runStatus?.identity?.runnerId || "")
    }),
    timeline,
    reusableShotIds,
    resubmitShotIds,
    counts:Object.freeze({
      shots:Number(runStatus?.counts?.shots || timeline.length),
      completed:Number(runStatus?.counts?.completed || 0),
      evaluated:Number(runStatus?.counts?.evaluated || 0)
    }),
    evidence:Object.freeze({
      coverage:Object.freeze({
        covered:Number(runStatus?.evaluationCoverage?.covered || 0),
        total:Number(runStatus?.evaluationCoverage?.total || timeline.length),
        complete:runStatus?.evaluationCoverage?.complete===true
      }),
      finalization:Object.freeze({
        closed:finalClosed,
        finalOutputSha256:runStatus?.finalization?.finalOutputSha256 || null,
        campaignEvidenceFingerprint:runStatus?.finalization?.campaignEvidenceFingerprint || null
      })
    }),
    controls:Object.freeze({
      start:canExecute ? enabled() : disabled(executionBlock),
      resume:canResume ? enabled() : disabled(
        !canExecute ? executionBlock : "run_already_completed"
      ),
      export:canExport ? enabled() : disabled(
        !integrityOk ? integrityError : "final_output_not_verified"
      )
    })
  });
}
