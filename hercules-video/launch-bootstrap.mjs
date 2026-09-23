import {readFile, writeFile, mkdir} from "node:fs/promises";
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
import {fingerprint} from "./core.mjs";

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
  const normalized={
    projectId:String(config.projectId || "hercules-launch"),
    runtimeId:String(config.runtimeId || "hercules-video-local"),
    wanRepoDir:requireAbsolute(config.wanRepoDir,"launch_wan_repo_dir_required"),
    checkpointDir:requireAbsolute(config.checkpointDir,"launch_checkpoint_dir_required"),
    renderOutputDir:requireAbsolute(config.renderOutputDir,"launch_render_output_dir_required"),
    finalOutputPath:requireAbsolute(config.finalOutputPath,"launch_final_output_path_required"),
    evidenceOutputPath:requireAbsolute(config.evidenceOutputPath,"launch_evidence_output_path_required"),
    upstreamCommit:requireCommit(config.upstreamCommit,"launch_upstream_commit_required"),
    checkpointSha256:requireSha256(config.checkpointSha256,"launch_checkpoint_sha256_required"),
    python:String(config.python || "python"),
    ffmpegBinary:String(config.ffmpegBinary || "ffmpeg"),
    renderTimeoutMs:Number(config.renderTimeoutMs ?? 30*60*1000),
    pollIntervalMs:Number(config.pollIntervalMs ?? 250),
    maxPolls:Number(config.maxPolls ?? 1200),
    minimumScore:Number(config.minimumScore ?? 0.78),
    audioTracks:Array.isArray(config.audioTracks) ? config.audioTracks : [],
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
  await writeFileImpl(absolute,bytes);
  return {
    path:absolute,
    sizeBytes:bytes.length,
    sha256:sha256Bytes(bytes),
    bundleFingerprint:bundle.fingerprint,
  };
}

export async function executeWan22Launch(config,{
  brief=null,
  qualityEvaluator,
  probeHost=probeCudaHost,
  runnerFactory,
  runtimeFactory,
  adapterFactory,
  serviceFactory,
  loadPreset,
  mkdirImpl=mkdir,
  writeFileImpl=writeFile,
  assemblyRunner=runFfmpegAssembly,
  clock=()=>new Date(),
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}) {
  if (typeof qualityEvaluator!=="function") throw new Error("launch_quality_evaluator_required");

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

  const session=await host.service.start(host.executionPlan);
  const rendered=await host.service.awaitRenders(host.executionPlan,session,{
    maxPolls:host.config.maxPolls,
    pollIntervalMs:host.config.pollIntervalMs,
  });

  const finalization=await host.service.finalize({
    executionPlan:host.executionPlan,
    session:rendered,
    evaluate:qualityEvaluator,
    audioTracks:host.config.audioTracks,
    assemblyPolicy:host.config.assemblyPolicy,
    assemblyRunner:(plan,{outputPath})=>assemblyRunner(plan,{
      outputPath,
      ffmpegBinary:host.config.ffmpegBinary,
    }),
    outputPath:host.config.finalOutputPath,
    minimumScore:host.config.minimumScore,
  });

  const bundle=createLaunchEvidenceBundle({
    executionPlan:host.executionPlan,
    finalization,
    hardwareProbe:host.hardwareProbe,
    config:host.config,
  });
  const exportEvidence=await writeLaunchEvidenceBundle(
    bundle,
    host.config.evidenceOutputPath,
    {writeFileImpl},
  );

  return {
    status:"completed",
    executionPlan:host.executionPlan,
    finalization,
    evidenceBundle:bundle,
    evidenceExport:exportEvidence,
  };
}
