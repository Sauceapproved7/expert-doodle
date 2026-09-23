import {readFile, writeFile, mkdir, stat} from "node:fs/promises";
import {createReadStream} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {probeCudaHost, assertWan22Hardware} from "./hardware-probe.mjs";
import {Wan22Ti2v5bRunner} from "./runners/wan22-ti2v-5b.mjs";
import {HerculesLocalVideoRuntime} from "./local-runtime.mjs";
import {HerculesSelfHostedRenderAdapter} from "./self-hosted-adapter.mjs";
import {HerculesCampaignExecutionService} from "./campaign-execution-service.mjs";
import {createCampaignExecutionPlan} from "./campaign-coordinator.mjs";
import {runFfmpegAssembly} from "./ffmpeg-assembly-runner.mjs";
import {createHerculesRenderQualityEvaluator} from "./render-quality-gate.mjs";
import {fingerprint} from "./core.mjs";
import {
  createLaunchRunState,
  readLaunchRunState,
  validateLaunchRunState,
  verifyLaunchRunStateArtifacts,
  writeLaunchRunStateAtomic,
} from "./launch-state.mjs";

function requireAbsolute(value, name) {
  const raw=String(value || "");
  if (!raw || !path.isAbsolute(raw)) throw new Error(name);
  return path.normalize(raw);
}

function requireSha256(value,name) {
  const hash=String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(name);
  return hash;
}

function requireCommit(value,name) {
  const commit=String(value || "").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(name);
  return commit;
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(filePath) {
  return new Promise((resolve,reject)=>{
    const hash=createHash("sha256");
    const stream=createReadStream(filePath);
    stream.on("error",reject);
    stream.on("data",chunk=>hash.update(chunk));
    stream.on("end",()=>resolve(hash.digest("hex")));
  });
}

async function assertFile(filePath,code) {
  const info=await stat(filePath).catch(()=>null);
  if (!info?.isFile()) throw new Error(code);
  return info;
}

async function assertAbsent(filePath,code) {
  const info=await stat(filePath).catch(()=>null);
  if (info) throw new Error(code);
}

function normalizeAudioEvidence(track,index) {
  const uri=String(track?.uri || "");
  if (!uri.startsWith("file://")) throw new Error("launch_audio_local_uri_required:" + index);
  return {
    ...track,
    uri,
    sha256:requireSha256(track?.sha256,"launch_audio_sha256_required:" + index),
  };
}

export async function loadHerculesLaunchPreset({
  readFileImpl=readFile,
  presetUrl=new URL("./presets/hercules-launch.json",import.meta.url),
}={}) {
  const raw=await readFileImpl(presetUrl,"utf8");
  const parsed=JSON.parse(raw);
  if (!parsed || typeof parsed!=="object") throw new Error("launch_preset_invalid");
  if (!String(parsed.title || "").trim()) throw new Error("launch_preset_title_required");
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length===0) throw new Error("launch_preset_scenes_required");
  return parsed;
}

export function normalizeWan22LaunchConfig(config={}) {
  const finalOutputPath=requireAbsolute(config.finalOutputPath,"launch_final_output_path_required");
  const evidenceOutputPath=requireAbsolute(config.evidenceOutputPath,"launch_evidence_output_path_required");
  const normalized={
    projectId:String(config.projectId || "hercules-launch"),
    runtimeId:String(config.runtimeId || "hercules-video-local"),
    wanRepoDir:requireAbsolute(config.wanRepoDir,"launch_wan_repo_dir_required"),
    checkpointDir:requireAbsolute(config.checkpointDir,"launch_checkpoint_dir_required"),
    renderOutputDir:requireAbsolute(config.renderOutputDir,"launch_render_output_dir_required"),
    finalOutputPath,
    evidenceOutputPath,
    statePath:requireAbsolute(
      config.statePath || evidenceOutputPath + ".state.json",
      "launch_state_path_required"
    ),
    resume:config.resume===true,
    upstreamCommit:requireCommit(config.upstreamCommit,"launch_upstream_commit_required"),
    checkpointSha256:requireSha256(config.checkpointSha256,"launch_checkpoint_sha256_required"),
    python:String(config.python || "python"),
    ffmpegBinary:String(config.ffmpegBinary || "ffmpeg"),
    renderTimeoutMs:Number(config.renderTimeoutMs ?? 30*60*1000),
    pollIntervalMs:Number(config.pollIntervalMs ?? 250),
    maxPolls:Number(config.maxPolls ?? 1200),
    minimumScore:Number(config.minimumScore ?? 0.78),
    audioTracks:Array.isArray(config.audioTracks) ? config.audioTracks.map(normalizeAudioEvidence) : [],
    assemblyPolicy:config.assemblyPolicy && typeof config.assemblyPolicy==="object" ? config.assemblyPolicy : {},
  };
  if (!normalized.projectId.trim()) throw new Error("launch_project_id_required");
  if (!normalized.runtimeId.trim()) throw new Error("launch_runtime_id_required");
  if (!Number.isInteger(normalized.renderTimeoutMs) || normalized.renderTimeoutMs<=0) throw new Error("launch_render_timeout_invalid");
  if (!Number.isFinite(normalized.pollIntervalMs) || normalized.pollIntervalMs<0) throw new Error("launch_poll_interval_invalid");
  if (!Number.isInteger(normalized.maxPolls) || normalized.maxPolls<=0) throw new Error("launch_max_polls_invalid");
  if (!Number.isFinite(normalized.minimumScore) || normalized.minimumScore<0 || normalized.minimumScore>1) throw new Error("launch_minimum_score_invalid");
  return normalized;
}

export async function prepareWan22LaunchHost(config,{
  brief=null,
  probeHost=probeCudaHost,
  runnerFactory=options=>new Wan22Ti2v5bRunner(options),
  runtimeFactory=options=>new HerculesLocalVideoRuntime(options),
  adapterFactory=options=>new HerculesSelfHostedRenderAdapter(options),
  serviceFactory=options=>new HerculesCampaignExecutionService(options),
  loadPreset=loadHerculesLaunchPreset,
  mkdirImpl=mkdir,
  clock=()=>new Date(),
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}) {
  const normalized=normalizeWan22LaunchConfig(config);
  await mkdirImpl(normalized.renderOutputDir,{recursive:true});
  await mkdirImpl(path.dirname(normalized.finalOutputPath),{recursive:true});
  await mkdirImpl(path.dirname(normalized.evidenceOutputPath),{recursive:true});
  await mkdirImpl(path.dirname(normalized.statePath),{recursive:true});
  if (!normalized.resume) {
    await assertAbsent(normalized.finalOutputPath,"launch_final_output_exists");
    await assertAbsent(normalized.evidenceOutputPath,"launch_evidence_output_exists");
    await assertAbsent(normalized.statePath,"launch_state_exists_resume_required");
  }

  for (const [index,track] of normalized.audioTracks.entries()) {
    const audioPath=fileURLToPath(track.uri);
    await assertFile(audioPath,"launch_audio_missing:" + index);
    const actualSha256=await sha256File(audioPath);
    if (actualSha256!==track.sha256) throw new Error("launch_audio_checksum_mismatch:" + index);
  }

  const hardwareProbe=await probeHost({minVramGb:24});
  const hardware=assertWan22Hardware(hardwareProbe,{minVramGb:24});

  const runner=runnerFactory({
    wanRepoDir:normalized.wanRepoDir,
    checkpointDir:normalized.checkpointDir,
    python:normalized.python,
    hardwareProbe,
    upstreamCommit:normalized.upstreamCommit,
    checkpointSha256:normalized.checkpointSha256,
    outputDir:normalized.renderOutputDir,
    timeoutMs:normalized.renderTimeoutMs,
  });
  const runnerHealth=await runner.health();
  if (runnerHealth?.ok!==true) throw new Error("launch_runner_unhealthy");

  const runtime=runtimeFactory({
    runtimeId:normalized.runtimeId,
    runner,
    clock,
    maxJobs:100,
  });
  const adapter=adapterFactory({
    id:"wan22-ti2v-5b-local",
    label:"Hercules Wan2.2 TI2V-5B Local",
    target:{kind:"self-hosted",runtimeId:normalized.runtimeId},
    transport:runtime,
  });
  const adapterHealth=await adapter.health();
  if (adapterHealth?.ok!==true) throw new Error("launch_adapter_unhealthy");

  const launchBrief=brief || await loadPreset();
  const provider={
    id:"wan22-ti2v-5b-local",
    label:"Hercules Wan2.2 TI2V-5B Local",
    kind:"self-hosted",
    capabilities:{
      aspectRatios:["9:16","16:9"],
      maxDurationSeconds:30,
      nativeAudio:false,
      references:true,
      editing:false,
    },
    quality:{},
    cost:{estimatedCreditsPerSecond:0,priorityPenalty:0},
  };
  const executionPlan=createCampaignExecutionPlan({
    projectId:normalized.projectId,
    brief:launchBrief,
    providers:[provider],
    resolution:"720p",
    fps:24,
    modelRef:"wan22-ti2v-5b@" + normalized.upstreamCommit,
    candidatesPerShot:1,
    maxCredits:Infinity,
  });

  const service=serviceFactory({adapter,clock,sleep});
  return {
    config:normalized,
    hardwareProbe,
    hardware,
    runner,
    runtime,
    adapter,
    service,
    executionPlan,
  };
}

export function createLaunchEvidenceBundle({
  executionPlan,
  finalization,
  hardwareProbe,
  config,
  evaluations=[],
  finalOutputSha256=null,
}) {
  if (!finalization?.campaignEvidence) throw new Error("launch_campaign_evidence_required");
  const unsigned={
    schema:"sauceapproved.hercules.video-launch-evidence-bundle",
    version:1,
    projectId:executionPlan.projectId,
    executionPlanFingerprint:executionPlan.fingerprint,
    executionSessionFingerprint:finalization.session?.fingerprint || null,
    winnersFingerprint:finalization.winners?.fingerprint || null,
    assemblyPlanFingerprint:finalization.assemblyPlan?.fingerprint || null,
    assemblyEvidenceFingerprint:finalization.assemblyResult?.evidence?.fingerprint || null,
    campaignEvidenceFingerprint:finalization.campaignEvidence.fingerprint,
    finalOutput:finalization.campaignEvidence.finalOutput,
    finalOutputSha256:finalOutputSha256 || finalization.campaignEvidence.finalOutput?.sha256 || null,
    evaluations,
    runtime:{
      modelRef:"wan22-ti2v-5b@" + config.upstreamCommit,
      upstreamCommit:config.upstreamCommit,
      checkpointSha256:config.checkpointSha256,
      hardwareProbe,
    },
  };
  return {...unsigned,fingerprint:fingerprint(unsigned)};
}

export async function writeLaunchEvidenceBundle(bundle,filePath,{writeFileImpl=writeFile}={}) {
  const absolute=requireAbsolute(filePath,"launch_evidence_output_path_required");
  const bytes=Buffer.from(JSON.stringify(bundle,null,2)+"\n","utf8");
  await writeFileImpl(absolute,bytes,{flag:"wx"});
  return {
    path:absolute,
    sizeBytes:bytes.length,
    sha256:sha256Bytes(bytes),
    bundleFingerprint:bundle.fingerprint,
  };
}

export function resolveLaunchQualityEvaluator({
  qualityEvaluator=null,
  semanticEvaluator=null,
  technicalProbe,
  technicalPolicy={},
}={}) {
  if (qualityEvaluator != null) {
    if (typeof qualityEvaluator!=="function" || qualityEvaluator.herculesRenderAcceptanceGate!==true) {
      throw new Error("launch_unverified_quality_evaluator_rejected");
    }
    return qualityEvaluator;
  }
  if (typeof semanticEvaluator!=="function") throw new Error("launch_semantic_evaluator_required");
  return createHerculesRenderQualityEvaluator({
    semanticEvaluator,
    ...(technicalProbe ? {technicalProbe} : {}),
    technicalPolicy,
  });
}

export async function executeWan22Launch(config,{
  brief=null,
  qualityEvaluator=null,
  semanticEvaluator=null,
  technicalProbe,
  technicalPolicy={},
  probeHost=probeCudaHost,
  runnerFactory,
  runtimeFactory,
  adapterFactory,
  serviceFactory,
  loadPreset,
  mkdirImpl=mkdir,
  writeFileImpl=writeFile,
  assemblyRunner=runFfmpegAssembly,
  readState=readLaunchRunState,
  writeState=writeLaunchRunStateAtomic,
  verifyStateArtifacts=verifyLaunchRunStateArtifacts,
  clock=()=>new Date(),
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}) {
  const verifiedQualityEvaluator=resolveLaunchQualityEvaluator({
    qualityEvaluator,
    semanticEvaluator,
    technicalProbe,
    technicalPolicy,
  });

  const host=await prepareWan22LaunchHost(config,{
    brief,
    probeHost,
    runnerFactory,
    runtimeFactory,
    adapterFactory,
    serviceFactory,
    loadPreset,
    mkdirImpl,
    clock,
    sleep,
  });

  let evaluations=[];
  let currentState=null;

  const persistState=async ({session,stage,finalOutputSha256=null,campaignEvidenceFingerprint=null})=>{
    currentState=createLaunchRunState({
      executionPlan:host.executionPlan,
      config:host.config,
      session,
      stage,
      evaluations,
      finalOutputSha256,
      campaignEvidenceFingerprint,
    });
    await writeState(currentState,host.config.statePath);
    return currentState;
  };

  let session;
  if (host.config.resume) {
    currentState=await readState(host.config.statePath);
    validateLaunchRunState(currentState,{executionPlan:host.executionPlan,config:host.config});
    await verifyStateArtifacts(currentState);
    if (currentState.stage==="completed") throw new Error("launch_resume_already_completed");

    const [finalInfo,evidenceInfo]=await Promise.all([
      stat(host.config.finalOutputPath).catch(()=>null),
      stat(host.config.evidenceOutputPath).catch(()=>null),
    ]);
    if (finalInfo || evidenceInfo) throw new Error("launch_resume_output_conflict");

    evaluations=structuredClone(currentState.evaluations || []);
    session=await host.service.resume(host.executionPlan,currentState.session);
  } else {
    session=await host.service.start(host.executionPlan);
  }
  await persistState({session,stage:"rendering"});

  let rendered=session;
  for (let poll=0; poll<host.config.maxPolls; poll+=1) {
    if (rendered.phase==="renders_completed") break;
    if (rendered.phase==="failed") {
      const error=new Error("campaign_execution_failed");
      error.session=rendered;
      throw error;
    }
    rendered=await host.service.refresh(host.executionPlan,rendered);
    await persistState({session:rendered,stage:"rendering"});
    if (rendered.phase==="renders_completed") break;
    if (rendered.phase==="failed") {
      const error=new Error("campaign_execution_failed");
      error.session=rendered;
      throw error;
    }
    if (poll+1<host.config.maxPolls) await sleep(host.config.pollIntervalMs);
  }
  if (rendered.phase!=="renders_completed") {
    const error=new Error("campaign_execution_poll_limit");
    error.session=rendered;
    throw error;
  }

  const evaluate=async context=>{
    const shotId=String(context?.shot?.id || "");
    const artifactSha256=requireSha256(
      context?.artifact?.sha256,
      "launch_evaluation_artifact_sha256_required:" + shotId
    );
    const existing=evaluations.find(item=>item.shotId===shotId);
    if (existing) {
      if (existing.artifactSha256!==artifactSha256) {
        throw new Error("launch_resume_evaluation_artifact_mismatch:" + shotId);
      }
      return structuredClone(existing.result);
    }

    const result=await verifiedQualityEvaluator(context);
    const unsigned={shotId,artifactSha256,result};
    evaluations.push({...unsigned,fingerprint:fingerprint(unsigned)});
    await persistState({session:rendered,stage:"finalizing"});
    return result;
  };

  await persistState({session:rendered,stage:"finalizing"});

  const finalization=await host.service.finalize({
    executionPlan:host.executionPlan,
    session:rendered,
    evaluate,
    audioTracks:host.config.audioTracks,
    assemblyPolicy:host.config.assemblyPolicy,
    assemblyRunner:(plan,{outputPath})=>assemblyRunner(plan,{
      outputPath,
      ffmpegBinary:host.config.ffmpegBinary,
    }),
    outputPath:host.config.finalOutputPath,
    minimumScore:host.config.minimumScore,
  });

  if (evaluations.length!==host.executionPlan.storyboard.shots.length) {
    throw new Error("launch_evaluation_incomplete");
  }
  const evaluatedShots=new Set(evaluations.map(item=>item.shotId));
  for (const shot of host.executionPlan.storyboard.shots) {
    if (!evaluatedShots.has(shot.id)) throw new Error("launch_evaluation_missing:" + shot.id);
  }

  await assertFile(host.config.finalOutputPath,"launch_final_output_missing");
  const finalOutputSha256=await sha256File(host.config.finalOutputPath);
  const claimedOutputSha256=requireSha256(
    finalization?.campaignEvidence?.finalOutput?.sha256,
    "launch_campaign_output_sha256_required"
  );
  if (finalOutputSha256!==claimedOutputSha256) throw new Error("launch_final_output_checksum_mismatch");

  const bundle=createLaunchEvidenceBundle({
    executionPlan:host.executionPlan,
    finalization,
    hardwareProbe:host.hardwareProbe,
    config:host.config,
    evaluations,
    finalOutputSha256,
  });
  const exportEvidence=await writeLaunchEvidenceBundle(
    bundle,
    host.config.evidenceOutputPath,
    {writeFileImpl},
  );

  await persistState({
    session:finalization.session,
    stage:"completed",
    finalOutputSha256,
    campaignEvidenceFingerprint:finalization.campaignEvidence.fingerprint,
  });

  return {
    status:"completed",
    executionPlan:host.executionPlan,
    finalization,
    evidenceBundle:bundle,
    evidenceExport:exportEvidence,
    launchState:currentState,
  };
}
