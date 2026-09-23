import {createHash} from "node:crypto";
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

const QUALITY_DIMENSIONS = Object.freeze([
  "promptAdherence",
  "temporalConsistency",
  "visualQuality",
  "brandConsistency",
  "audioQuality",
  "artifactFreedom",
  "reliability",
]);

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

  return {
    schema:"sauceapproved.hercules.video-launch-config",
    version:1,
    projectId:String(config.projectId || "hercules-launch"),
    presetPath:absolute(config.presetPath, "launch_preset_path_required"),
    wanRepoDir:absolute(config.wanRepoDir, "launch_wan_repo_dir_required"),
    checkpointDir:absolute(config.checkpointDir, "launch_checkpoint_dir_required"),
    checkpointSha256:sha256(config.checkpointSha256, "launch_checkpoint_sha256_required"),
    upstreamCommit:String(config.upstreamCommit || "").toLowerCase(),
    renderOutputDir:absolute(config.renderOutputDir, "launch_render_output_dir_required"),
    finalOutputPath:absolute(config.finalOutputPath, "launch_final_output_path_required"),
    evaluationEvidencePath:absolute(config.evaluationEvidencePath, "launch_evaluation_evidence_path_required"),
    evidenceOutputPath:absolute(
      config.evidenceOutputPath || String(config.finalOutputPath || "") + ".evidence.json",
      "launch_evidence_output_path_required"
    ),
    python:String(config.python || "python"),
    ffmpegBinary:String(config.ffmpegBinary || "ffmpeg"),
    runtimeId:String(config.runtimeId || "hercules-video-local"),
    minimumScore:Number(config.minimumScore ?? 0.78),
    maxPolls:Number(config.maxPolls ?? 120),
    pollIntervalMs:Number(config.pollIntervalMs ?? 250),
    audioTracks,
  };
}

export async function validateLaunchInputs(config) {
  const normalized = normalizeLaunchConfig(config);
  if (!/^[a-f0-9]{40}$/.test(normalized.upstreamCommit)) throw new Error("launch_upstream_commit_required");
  if (!Number.isFinite(normalized.minimumScore) || normalized.minimumScore < 0 || normalized.minimumScore > 1) {
    throw new Error("launch_minimum_score_invalid");
  }
  if (!Number.isInteger(normalized.maxPolls) || normalized.maxPolls <= 0) throw new Error("launch_max_polls_invalid");
  if (!Number.isFinite(normalized.pollIntervalMs) || normalized.pollIntervalMs < 0) {
    throw new Error("launch_poll_interval_invalid");
  }

  await assertFile(normalized.presetPath, "launch_preset_missing");
  await assertDirectory(normalized.wanRepoDir, "launch_wan_repo_missing");
  await assertDirectory(normalized.checkpointDir, "launch_checkpoint_missing");
  await assertDirectory(normalized.renderOutputDir, "launch_render_output_dir_missing");
  await assertFile(normalized.evaluationEvidencePath, "launch_evaluation_evidence_missing");

  for (const [index, track] of normalized.audioTracks.entries()) {
    await assertFile(track.path, "launch_audio_missing:" + index);
    const actual = await sha256File(track.path);
    if (actual !== track.sha256) throw new Error("launch_audio_checksum_mismatch:" + index);
  }

  return normalized;
}

export function createEvidenceEvaluator(evidence) {
  if (!evidence || typeof evidence !== "object") throw new Error("launch_evaluation_evidence_invalid");
  const shots = evidence.shots;
  if (!shots || typeof shots !== "object" || Array.isArray(shots)) {
    throw new Error("launch_evaluation_shots_required");
  }

  return async ({shot, artifact}) => {
    const shotId = String(shot?.id || "");
    const entry = shots[shotId];
    if (!entry || typeof entry !== "object") throw new Error("launch_evaluation_missing:" + shotId);
    const expectedArtifact = sha256(entry.artifactSha256, "launch_evaluation_artifact_sha256_required:" + shotId);
    if (expectedArtifact !== String(artifact?.sha256 || "").toLowerCase()) {
      throw new Error("launch_evaluation_artifact_mismatch:" + shotId);
    }
    return normalizeQuality(entry.quality, shotId);
  };
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
  const normalized = await validateLaunchInputs(config);
  const readJson = dependencies.readJson || (async filePath => JSON.parse(await readFile(filePath,"utf8")));
  const writeEvidence = dependencies.writeEvidence || (async (filePath,value) => {
    await writeFile(filePath, JSON.stringify(value,null,2) + "\n", {encoding:"utf8",flag:"wx"});
  });
  const probe = dependencies.probeHardware ? await dependencies.probeHardware() : await probeCudaHost();

  const brief = await readJson(normalized.presetPath);
  const evaluationEvidence = await readJson(normalized.evaluationEvidencePath);
  const evaluate = createEvidenceEvaluator(evaluationEvidence);

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
    evaluate,
    audioTracks,
    assemblyRunner,
    outputPath:normalized.finalOutputPath,
    minimumScore:normalized.minimumScore,
  });

  const launchEvidence = {
    schema:"sauceapproved.hercules.video-launch-evidence",
    version:1,
    projectId:normalized.projectId,
    executionPlanFingerprint:executionPlan.fingerprint,
    sessionFingerprint:finalized.session.fingerprint,
    campaignEvidence:finalized.campaignEvidence,
    runtime:{
      runtimeId:normalized.runtimeId,
      runnerId:runner.descriptor?.id || null,
      upstreamCommit:normalized.upstreamCommit,
      checkpointSha256:normalized.checkpointSha256,
    },
    inputs:{
      presetPath:normalized.presetPath,
      evaluationEvidencePath:normalized.evaluationEvidencePath,
      audioTracks:audioTracks.map(track => ({
        id:track.id,
        kind:track.kind,
        uri:track.uri,
        sha256:track.sha256,
      })),
    },
  };

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
  }) + "\n");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    process.stderr.write(JSON.stringify({ok:false,error:String(error?.message || error)}) + "\n");
    process.exitCode=1;
  });
}
