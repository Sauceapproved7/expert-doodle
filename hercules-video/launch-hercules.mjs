import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {readFile, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {probeCudaHost} from "./hardware-probe.mjs";
import {Wan22Ti2v5bRunner} from "./runners/wan22-ti2v-5b.mjs";
import {HerculesLocalVideoRuntime} from "./local-runtime.mjs";
import {HerculesSelfHostedRenderAdapter} from "./self-hosted-adapter.mjs";
import {createCampaignExecutionPlan} from "./campaign-coordinator.mjs";
import {HerculesCampaignExecutionService} from "./campaign-execution-service.mjs";
import {runFfmpegAssembly} from "./ffmpeg-assembly-runner.mjs";
import {fingerprint} from "./core.mjs";

const QUALITY_DIMENSIONS = Object.freeze([
  "promptAdherence",
  "temporalConsistency",
  "visualQuality",
  "brandConsistency",
  "audioQuality",
  "artifactFreedom",
  "reliability",
]);

const CANONICAL_PRESET_PATH = fileURLToPath(new URL("./presets/hercules-launch.json", import.meta.url));

function absolute(value, code) {
  const raw = String(value || "");
  if (!raw || !path.isAbsolute(raw)) throw new Error(code);
  return path.normalize(raw);
}

function sha256(value, code) {
  const hash = String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(code);
  return hash;
}

async function assertFile(filePath, code) {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw new Error(code);
  return info;
}

async function assertDirectory(dirPath, code) {
  const info = await stat(dirPath).catch(() => null);
  if (!info?.isDirectory()) throw new Error(code);
  return info;
}

async function assertAbsent(filePath, code) {
  const info = await stat(filePath).catch(() => null);
  if (info) throw new Error(code);
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function normalizeQuality(quality, shotId) {
  if (!quality || typeof quality !== "object") {
    throw new Error("launch_evaluation_quality_required:" + shotId);
  }
  const normalized = {};
  for (const dimension of QUALITY_DIMENSIONS) {
    const value = Number(quality[dimension]);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error("launch_evaluation_quality_invalid:" + shotId + ":" + dimension);
    }
    normalized[dimension] = value;
  }
  return normalized;
}

function normalizeEvaluatorResult(result, context) {
  const shotId = String(context?.shot?.id || "");
  if (!result || typeof result !== "object") throw new Error("launch_evaluation_result_required:" + shotId);
  const artifactSha256 = sha256(
    result.artifactSha256,
    "launch_evaluation_artifact_sha256_required:" + shotId
  );
  if (artifactSha256 !== String(context?.artifact?.sha256 || "").toLowerCase()) {
    throw new Error("launch_evaluation_artifact_mismatch:" + shotId);
  }
  const method = String(result.method || "").trim();
  if (!method) throw new Error("launch_evaluation_method_required:" + shotId);
  const evaluatorId = String(result.evaluatorId || "local-evaluator").trim();
  if (!evaluatorId) throw new Error("launch_evaluator_id_required:" + shotId);
  const quality = normalizeQuality(result.quality, shotId);
  const base = {shotId,artifactSha256,method,evaluatorId,quality};
  return {...base,fingerprint:fingerprint(base)};
}

export function normalizeLaunchConfig(config) {
  if (!config || typeof config !== "object") throw new Error("launch_config_required");

  const audioTracks = Array.isArray(config.audioTracks) ? config.audioTracks.map((track, index) => ({
    id:String(track?.id || `audio-${index + 1}`),
    kind:String(track?.kind || ""),
    path:absolute(track?.path, "launch_audio_path_required:" + index),
    startSeconds:Number(track?.startSeconds ?? 0),
    durationSeconds:Number(track?.durationSeconds),
    gainDb:Number(track?.gainDb ?? 0),
    sha256:sha256(track?.sha256, "launch_audio_sha256_required:" + index),
  })) : [];

  for (const [index, track] of audioTracks.entries()) {
    if (!["soundtrack","ambience","sfx","narration"].includes(track.kind)) {
      throw new Error("launch_audio_kind_invalid:" + index);
    }
    if (!Number.isFinite(track.startSeconds) || track.startSeconds < 0) {
      throw new Error("launch_audio_start_invalid:" + index);
    }
    if (!Number.isFinite(track.durationSeconds) || track.durationSeconds <= 0) {
      throw new Error("launch_audio_duration_invalid:" + index);
    }
    if (!Number.isFinite(track.gainDb) || track.gainDb < -60 || track.gainDb > 12) {
      throw new Error("launch_audio_gain_invalid:" + index);
    }
  }

  const evaluationArgs = config.evaluationArgs == null ? [] : config.evaluationArgs;
  if (!Array.isArray(evaluationArgs) || evaluationArgs.some(value => typeof value !== "string")) {
    throw new Error("launch_evaluation_args_invalid");
  }

  return {
    schema:"sauceapproved.hercules.video-launch-config",
    version:1,
    projectId:String(config.projectId || "hercules-launch"),
    presetPath:config.presetPath
      ? absolute(config.presetPath, "launch_preset_path_required")
      : CANONICAL_PRESET_PATH,
    wanRepoDir:absolute(config.wanRepoDir, "launch_wan_repo_dir_required"),
    checkpointDir:absolute(config.checkpointDir, "launch_checkpoint_dir_required"),
    checkpointSha256:sha256(config.checkpointSha256, "launch_checkpoint_sha256_required"),
    upstreamCommit:String(config.upstreamCommit || "").toLowerCase(),
    renderOutputDir:absolute(config.renderOutputDir, "launch_render_output_dir_required"),
    finalOutputPath:absolute(config.finalOutputPath, "launch_final_output_path_required"),
    evidenceOutputPath:absolute(
      config.evidenceOutputPath || String(config.finalOutputPath || "") + ".evidence.json",
      "launch_evidence_output_path_required"
    ),
    evaluationCommand:config.evaluationCommand
      ? absolute(config.evaluationCommand, "launch_evaluation_command_invalid")
      : null,
    evaluationArgs:[...evaluationArgs],
    evaluationTimeoutMs:Number(config.evaluationTimeoutMs ?? 60_000),
    python:String(config.python || "python"),
    ffmpegBinary:String(config.ffmpegBinary || "ffmpeg"),
    runtimeId:String(config.runtimeId || "hercules-video-local"),
    minimumScore:Number(config.minimumScore ?? 0.78),
    maxPolls:Number(config.maxPolls ?? 120),
    pollIntervalMs:Number(config.pollIntervalMs ?? 250),
    audioTracks,
  };
}

export async function validateLaunchInputs(config, {requireEvaluator=true}={}) {
  const normalized = normalizeLaunchConfig(config);
  if (path.resolve(normalized.presetPath) !== path.resolve(CANONICAL_PRESET_PATH)) {
    throw new Error("launch_preset_must_be_canonical");
  }
  if (!/^[a-f0-9]{40}$/.test(normalized.upstreamCommit)) throw new Error("launch_upstream_commit_required");
  if (!Number.isFinite(normalized.minimumScore) || normalized.minimumScore < 0 || normalized.minimumScore > 1) {
    throw new Error("launch_minimum_score_invalid");
  }
  if (!Number.isInteger(normalized.maxPolls) || normalized.maxPolls <= 0) throw new Error("launch_max_polls_invalid");
  if (!Number.isFinite(normalized.pollIntervalMs) || normalized.pollIntervalMs < 0) {
    throw new Error("launch_poll_interval_invalid");
  }
  if (!Number.isInteger(normalized.evaluationTimeoutMs) || normalized.evaluationTimeoutMs <= 0) {
    throw new Error("launch_evaluation_timeout_invalid");
  }
  if (requireEvaluator && !normalized.evaluationCommand) throw new Error("launch_evaluation_command_required");

  await assertFile(normalized.presetPath, "launch_preset_missing");
  await assertDirectory(normalized.wanRepoDir, "launch_wan_repo_missing");
  await assertDirectory(normalized.checkpointDir, "launch_checkpoint_missing");
  await assertDirectory(normalized.renderOutputDir, "launch_render_output_dir_missing");
  await assertDirectory(path.dirname(normalized.finalOutputPath), "launch_final_output_parent_missing");
  await assertDirectory(path.dirname(normalized.evidenceOutputPath), "launch_evidence_output_parent_missing");
  await assertAbsent(normalized.finalOutputPath, "launch_final_output_exists");
  await assertAbsent(normalized.evidenceOutputPath, "launch_evidence_output_exists");
  if (normalized.evaluationCommand) {
    await assertFile(normalized.evaluationCommand, "launch_evaluation_command_missing");
  }

  for (const [index, track] of normalized.audioTracks.entries()) {
    await assertFile(track.path, "launch_audio_missing:" + index);
    const actual = await sha256File(track.path);
    if (actual !== track.sha256) throw new Error("launch_audio_checksum_mismatch:" + index);
  }

  return normalized;
}

export async function runLocalEvaluator({
  command,
  args=[],
  timeoutMs=60_000,
  context,
  spawnImpl=spawn,
}) {
  const payload = JSON.stringify({
    schema:"sauceapproved.hercules.video-evaluation-request",
    version:1,
    shot:context.shot,
    request:context.request,
    artifact:context.artifact,
    route:context.route,
  });

  return new Promise((resolve,reject)=>{
    const child = spawnImpl(command,args,{
      shell:false,
      stdio:["pipe","pipe","pipe"],
      env:{
        PATH:process.env.PATH || "",
        SYSTEMROOT:process.env.SYSTEMROOT || "",
      },
    });
    let stdout="";
    let stderr="";
    let settled=false;

    const timer=setTimeout(()=>{
      if (settled) return;
      settled=true;
      child.kill("SIGTERM");
      reject(new Error("launch_evaluation_timeout:" + String(context?.shot?.id || "")));
    },timeoutMs);

    child.stdout?.on("data",chunk=>{stdout+=chunk.toString();});
    child.stderr?.on("data",chunk=>{stderr+=chunk.toString();});
    child.once("error",error=>{
      if (settled) return;
      settled=true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close",code=>{
      if (settled) return;
      settled=true;
      clearTimeout(timer);
      if (code!==0) {
        reject(new Error("launch_evaluation_failed:" + String(context?.shot?.id || "") + ":" + stderr.slice(-500)));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("launch_evaluation_output_invalid:" + String(context?.shot?.id || "")));
      }
    });
    child.stdin?.end(payload);
  });
}

function createEvaluationBoundary({normalized, injectedEvaluate, spawnImpl=spawn}) {
  const records=[];
  const evaluate=async context=>{
    const raw = injectedEvaluate
      ? await injectedEvaluate(context)
      : await runLocalEvaluator({
          command:normalized.evaluationCommand,
          args:normalized.evaluationArgs,
          timeoutMs:normalized.evaluationTimeoutMs,
          context,
          spawnImpl,
        });
    const record=normalizeEvaluatorResult(raw,context);
    records.push(record);
    return record.quality;
  };
  return {evaluate,records};
}

function providerDescriptor(runtimeId) {
  return {
    id:"wan22-ti2v-5b-local",
    label:"Wan2.2 TI2V-5B Local",
    kind:"self-hosted",
    runtimeId,
    capabilities:{
      aspectRatios:["9:16","16:9"],
      maxDurationSeconds:10,
      nativeAudio:false,
      references:true,
      editing:false,
    },
    quality:Object.fromEntries(QUALITY_DIMENSIONS.map(key => [key,0])),
    cost:{estimatedCreditsPerSecond:0,priorityPenalty:0},
  };
}

export async function runHerculesLaunch(config, dependencies={}) {
  const normalized = await validateLaunchInputs(config,{requireEvaluator:typeof dependencies.evaluate!=="function"});
  const readJson = dependencies.readJson || (async filePath => JSON.parse(await readFile(filePath,"utf8")));
  const writeEvidence = dependencies.writeEvidence || (async (filePath,value) => {
    await writeFile(filePath, JSON.stringify(value,null,2) + "\n", {encoding:"utf8",flag:"wx"});
  });

  const probe = dependencies.probeHardware ? await dependencies.probeHardware() : await probeCudaHost();
  const brief = await readJson(normalized.presetPath);
  const presetSha256 = await sha256File(normalized.presetPath);

  const runner = dependencies.runner || new Wan22Ti2v5bRunner({
    wanRepoDir:normalized.wanRepoDir,
    checkpointDir:normalized.checkpointDir,
    python:normalized.python,
    hardwareProbe:probe,
    upstreamCommit:normalized.upstreamCommit,
    checkpointSha256:normalized.checkpointSha256,
    outputDir:normalized.renderOutputDir,
  });

  const runtime = dependencies.runtime || new HerculesLocalVideoRuntime({
    runtimeId:normalized.runtimeId,
    runner,
  });
  const adapter = dependencies.adapter || new HerculesSelfHostedRenderAdapter({
    id:"hercules-launch-local",
    label:"Hercules Launch Local",
    target:{kind:"self-hosted",runtimeId:normalized.runtimeId},
    transport:runtime,
  });
  const service = dependencies.service || new HerculesCampaignExecutionService({adapter});

  const executionPlan = createCampaignExecutionPlan({
    projectId:normalized.projectId,
    brief,
    providers:[providerDescriptor(normalized.runtimeId)],
    modelRef:"wan22-ti2v-5b@" + normalized.upstreamCommit,
    candidatesPerShot:1,
  });

  const requiresPostAudio = executionPlan.storyboard.shots.some(
    shot=>shot.requiresAudio && shot.audioStrategy==="post"
  );
  if (requiresPostAudio && normalized.audioTracks.length===0) {
    throw new Error("launch_post_audio_required");
  }

  const evaluation = createEvaluationBoundary({
    normalized,
    injectedEvaluate:dependencies.evaluate,
    spawnImpl:dependencies.spawnEvaluator || spawn,
  });

  const session = await service.start(executionPlan);
  const rendered = await service.awaitRenders(executionPlan,session,{
    maxPolls:normalized.maxPolls,
    pollIntervalMs:normalized.pollIntervalMs,
  });

  const audioTracks = normalized.audioTracks.map(track => ({
    id:track.id,
    kind:track.kind,
    uri:pathToFileURL(track.path).href,
    startSeconds:track.startSeconds,
    durationSeconds:track.durationSeconds,
    gainDb:track.gainDb,
    sha256:track.sha256,
  }));

  const assemblyRunner = dependencies.assemblyRunner || ((plan,{outputPath}) => runFfmpegAssembly(plan,{
    outputPath,
    ffmpegBinary:normalized.ffmpegBinary,
  }));

  const finalized = await service.finalize({
    executionPlan,
    session:rendered,
    evaluate:evaluation.evaluate,
    audioTracks,
    assemblyRunner,
    outputPath:normalized.finalOutputPath,
    minimumScore:normalized.minimumScore,
  });

  if (evaluation.records.length !== executionPlan.storyboard.shots.length) {
    throw new Error("launch_evaluation_incomplete");
  }
  const evaluatedShots = new Set(evaluation.records.map(record=>record.shotId));
  for (const shot of executionPlan.storyboard.shots) {
    if (!evaluatedShots.has(shot.id)) throw new Error("launch_evaluation_missing:" + shot.id);
  }

  await assertFile(normalized.finalOutputPath, "launch_final_output_missing");
  const finalOutputSha256 = await sha256File(normalized.finalOutputPath);
  const claimedOutputSha256 = sha256(
    finalized?.campaignEvidence?.finalOutput?.sha256,
    "launch_campaign_output_sha256_required"
  );
  if (finalOutputSha256 !== claimedOutputSha256) throw new Error("launch_final_output_checksum_mismatch");

  const launchEvidenceBase = {
    schema:"sauceapproved.hercules.video-launch-evidence",
    version:1,
    projectId:normalized.projectId,
    executionPlanFingerprint:executionPlan.fingerprint,
    sessionFingerprint:finalized.session.fingerprint,
    campaignEvidence:finalized.campaignEvidence,
    evaluations:[...evaluation.records],
    runtime:{
      runtimeId:normalized.runtimeId,
      runnerId:runner.descriptor?.id || null,
      upstreamCommit:normalized.upstreamCommit,
      checkpointSha256:normalized.checkpointSha256,
    },
    finalOutputSha256,
    inputs:{
      presetPath:normalized.presetPath,
      presetSha256,
      audioTracks:audioTracks.map(track => ({
        id:track.id,
        kind:track.kind,
        uri:track.uri,
        sha256:track.sha256,
      })),
      evaluation:{
        kind:dependencies.evaluate ? "injected" : "local-command",
        command:dependencies.evaluate ? null : normalized.evaluationCommand,
      },
    },
  };
  const launchEvidence = {...launchEvidenceBase,fingerprint:fingerprint(launchEvidenceBase)};

  await writeEvidence(normalized.evidenceOutputPath,launchEvidence);
  return {
    evidencePath:normalized.evidenceOutputPath,
    outputPath:normalized.finalOutputPath,
    launchEvidence,
    finalized,
  };
}

async function main(argv=process.argv.slice(2)) {
  if (argv.length !== 1) throw new Error("usage: node hercules-video/launch-hercules.mjs /absolute/path/to/config.json");
  const configPath = absolute(argv[0],"launch_config_path_required");
  const config = JSON.parse(await readFile(configPath,"utf8"));
  const result = await runHerculesLaunch(config);
  process.stdout.write(JSON.stringify({
    ok:true,
    outputPath:result.outputPath,
    evidencePath:result.evidencePath,
    campaignEvidenceFingerprint:result.finalized.campaignEvidence.fingerprint,
    launchEvidenceFingerprint:result.launchEvidence.fingerprint,
  }) + "\n");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    process.stderr.write(JSON.stringify({ok:false,error:String(error?.message || error)}) + "\n");
    process.exitCode=1;
  });
}
