import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {stat} from "node:fs/promises";
import {normalizeQuality} from "./core.mjs";

const execFileAsync=promisify(execFile);

function rational(value) {
  const text=String(value||"");
  if (text.includes("/")) {
    const [a,b]=text.split("/").map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b!==0) return a/b;
  }
  const n=Number(text);
  return Number.isFinite(n)?n:null;
}

function expectedRatio(aspectRatio) {
  const m=String(aspectRatio||"").match(/^([0-9.]+):([0-9.]+)$/);
  if (!m) throw new Error("quality_aspect_ratio_invalid");
  const w=Number(m[1]),h=Number(m[2]);
  if (!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0) throw new Error("quality_aspect_ratio_invalid");
  return w/h;
}

export async function ffprobeTechnicalMedia(fileUri,{
  exec=execFileAsync,
  ffprobeBinary="ffprobe",
}={}) {
  const uri=String(fileUri||"");
  if (!uri.startsWith("file://")) throw new Error("quality_local_file_required");
  const filePath=fileURLToPath(uri);
  const info=await stat(filePath).catch(()=>null);
  if (!info?.isFile() || info.size<=0) throw new Error("quality_media_file_missing");
  const {stdout}=await exec(ffprobeBinary,[
    "-v","error",
    "-select_streams","v:0",
    "-show_entries","stream=width,height,avg_frame_rate,r_frame_rate,codec_name:format=duration",
    "-of","json",
    filePath,
  ],{timeout:15000});
  const parsed=JSON.parse(stdout);
  const stream=parsed?.streams?.[0];
  if (!stream) throw new Error("quality_video_stream_required");
  return {
    width:Number(stream.width),
    height:Number(stream.height),
    fps:rational(stream.avg_frame_rate)||rational(stream.r_frame_rate),
    codec:String(stream.codec_name||""),
    durationSeconds:Number(parsed?.format?.duration),
    sizeBytes:info.size,
  };
}

export function evaluateTechnicalMedia({
  media,
  expectedAspectRatio,
  expectedDurationSeconds,
  expectedFps=24,
  ratioTolerance=0.06,
  durationToleranceSeconds=0.4,
  fpsTolerance=2,
}) {
  if (!media||typeof media!=="object") throw new Error("quality_media_required");
  const width=Number(media.width),height=Number(media.height),fps=Number(media.fps),duration=Number(media.durationSeconds);
  if (!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0) throw new Error("quality_dimensions_invalid");
  if (!Number.isFinite(fps)||fps<=0) throw new Error("quality_fps_invalid");
  if (!Number.isFinite(duration)||duration<=0) throw new Error("quality_duration_invalid");
  const ratio=width/height;
  const target=expectedRatio(expectedAspectRatio);
  const ratioError=Math.abs(ratio-target);
  const durationError=Math.abs(duration-Number(expectedDurationSeconds));
  const fpsError=Math.abs(fps-Number(expectedFps));
  const checks={
    aspectRatio:ratioError<=ratioTolerance,
    duration:durationError<=durationToleranceSeconds,
    fps:fpsError<=fpsTolerance,
  };
  return {
    passed:Object.values(checks).every(Boolean),
    checks,
    measured:{width,height,fps,durationSeconds:duration,aspectRatio:ratio},
    deltas:{ratioError,durationError,fpsError},
  };
}

export function createHerculesRenderQualityEvaluator({
  technicalProbe=ffprobeTechnicalMedia,
  semanticEvaluator,
  technicalPolicy={},
}={}) {
  if (typeof technicalProbe!=="function") throw new Error("quality_technical_probe_required");
  if (typeof semanticEvaluator!=="function") throw new Error("quality_semantic_evaluator_required");

  const evaluate=async function evaluate({shot,artifact,request,route}) {
    if (!shot||!artifact) throw new Error("quality_context_required");
    const media=await technicalProbe(artifact.uri);
    const technical=evaluateTechnicalMedia({
      media,
      expectedAspectRatio:shot.aspectRatio,
      expectedDurationSeconds:artifact.durationSeconds ?? shot.durationSeconds,
      expectedFps:request?.output?.fps ?? 24,
      ...technicalPolicy,
    });
    if (!technical.passed) {
      const error=new Error("quality_technical_gate_failed:" + shot.id);
      error.technical=technical;
      throw error;
    }

    const semantic=await semanticEvaluator({shot,artifact,request,route,technical});
    if (!semantic||typeof semantic!=="object") throw new Error("quality_semantic_result_required:" + shot.id);
    const quality=normalizeQuality({
      promptAdherence:semantic.promptAdherence,
      temporalConsistency:semantic.temporalConsistency,
      visualQuality:semantic.visualQuality,
      brandConsistency:semantic.brandConsistency,
      audioQuality:shot.audioStrategy==="post" ? 1 : semantic.audioQuality,
      artifactFreedom:semantic.artifactFreedom,
      reliability:semantic.reliability ?? 1,
    });
    return {
      ...quality,
      technicalPassed:true,
      technicalEvidence:technical,
    };
  };
  Object.defineProperties(evaluate,{
    herculesRenderAcceptanceGate:{value:true,enumerable:false},
    herculesRenderAcceptanceGateVersion:{value:1,enumerable:false},
  });
  return evaluate;
}
