import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {stat} from "node:fs/promises";
import {fingerprint} from "../core.mjs";
import {verifyLocalModelManifest} from "../local-model-manifest.mjs";

const MODEL_ID="Qwen/Qwen3-VL-4B-Instruct";
const MODEL_LICENSE="apache-2.0";

function absolute(value,name) {
  const raw=String(value||"");
  if (!raw || !path.isAbsolute(raw)) throw new Error(name);
  return path.normalize(raw);
}

function localVideoPath(uri) {
  const value=String(uri||"");
  if (!value.startsWith("file://")) throw new Error("qwen_evaluator_local_video_required");
  return fileURLToPath(value);
}

function normalizeScore(value,name) {
  const number=Number(value);
  if (!Number.isFinite(number) || number<0 || number>1) throw new Error("qwen_evaluator_score_invalid:"+name);
  return number;
}

function parseWorkerResponse(stdout) {
  let parsed;
  try { parsed=JSON.parse(String(stdout||"").trim()); }
  catch { throw new Error("qwen_evaluator_worker_json_invalid"); }
  if (parsed?.ok!==true) throw new Error("qwen_evaluator_worker_failed");
  const scores=parsed.scores;
  if (!scores || typeof scores!=="object") throw new Error("qwen_evaluator_scores_required");
  const normalized={
    promptAdherence:normalizeScore(scores.promptAdherence,"promptAdherence"),
    temporalConsistency:normalizeScore(scores.temporalConsistency,"temporalConsistency"),
    visualQuality:normalizeScore(scores.visualQuality,"visualQuality"),
    brandConsistency:normalizeScore(scores.brandConsistency,"brandConsistency"),
    artifactFreedom:normalizeScore(scores.artifactFreedom,"artifactFreedom"),
    reliability:normalizeScore(scores.reliability,"reliability"),
  };
  return {
    scores:normalized,
    notes:Array.isArray(parsed.notes) ? parsed.notes.map(note=>String(note).slice(0,500)).slice(0,12) : [],
    rawEvidence:{
      modelId:String(parsed.modelId||MODEL_ID),
      modelRevision:String(parsed.modelRevision||""),
      sampledFps:Number(parsed.sampledFps||0),
    },
  };
}

function runWorker(command,args,payload,{spawnImpl=spawn,timeoutMs=10*60*1000}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawnImpl(command,args,{
      stdio:["pipe","pipe","pipe"],
      shell:false,
      env:{
        ...process.env,
        HF_HUB_OFFLINE:"1",
        TRANSFORMERS_OFFLINE:"1",
      },
    });
    let stdout="",stderr="",settled=false;
    const timer=setTimeout(()=>{
      if (settled) return;
      settled=true;
      child.kill("SIGTERM");
      const error=new Error("qwen_evaluator_timeout");
      error.code="qwen_evaluator_timeout";
      reject(error);
    },timeoutMs);
    child.stdout?.on("data",chunk=>{stdout+=chunk.toString();});
    child.stderr?.on("data",chunk=>{stderr+=chunk.toString();});
    child.once("error",error=>{
      if (settled) return;
      settled=true; clearTimeout(timer); reject(error);
    });
    child.once("close",code=>{
      if (settled) return;
      settled=true; clearTimeout(timer);
      if (code!==0) {
        const error=new Error("qwen_evaluator_process_failed:"+stderr.slice(-1000));
        error.code="qwen_evaluator_process_failed";
        reject(error);
      } else resolve({stdout,stderr});
    });
    child.stdin?.end(JSON.stringify(payload));
  });
}

export function createQwen3Vl4bSemanticEvaluator({
  modelDir,
  manifestPath,
  workerPath=new URL("./qwen3_vl_worker.py",import.meta.url),
  python="python",
  sampleFps=2,
  timeoutMs=10*60*1000,
  spawnImpl=spawn,
  verifyManifest=verifyLocalModelManifest,
  statImpl=stat,
}={}) {
  const localModelDir=absolute(modelDir,"qwen_evaluator_model_dir_required");
  const localManifestPath=absolute(manifestPath,"qwen_evaluator_manifest_path_required");
  const localWorkerPath=workerPath instanceof URL ? fileURLToPath(workerPath) : absolute(workerPath,"qwen_evaluator_worker_path_required");
  const fps=Number(sampleFps);
  if (!Number.isFinite(fps) || fps<=0 || fps>8) throw new Error("qwen_evaluator_sample_fps_invalid");
  if (!Number.isInteger(timeoutMs) || timeoutMs<=0) throw new Error("qwen_evaluator_timeout_invalid");

  let modelEvidencePromise=null;
  async function ensureReady() {
    if (!modelEvidencePromise) {
      modelEvidencePromise=(async()=>{
        const workerInfo=await statImpl(localWorkerPath).catch(()=>null);
        if (!workerInfo?.isFile()) throw new Error("qwen_evaluator_worker_missing");
        return verifyManifest({
          modelDir:localModelDir,
          manifestPath:localManifestPath,
          expectedModelId:MODEL_ID,
          expectedLicense:MODEL_LICENSE,
        });
      })();
    }
    return modelEvidencePromise;
  }

  const evaluate=async function semanticEvaluator({shot,artifact,technical}) {
    if (!shot || !artifact) throw new Error("qwen_evaluator_context_required");
    const modelEvidence=await ensureReady();
    const videoPath=localVideoPath(artifact.uri);
    const videoInfo=await statImpl(videoPath).catch(()=>null);
    if (!videoInfo?.isFile() || videoInfo.size<=0) throw new Error("qwen_evaluator_video_missing");

    const payload={
      schema:"sauceapproved.hercules.video-qwen-evaluation-request",
      version:1,
      modelId:MODEL_ID,
      modelRevision:modelEvidence.revision,
      modelDir:localModelDir,
      videoUri:artifact.uri,
      sampleFps:fps,
      shot:{
        id:String(shot.id),
        prompt:String(shot.prompt||""),
        text:shot.text ? String(shot.text) : null,
        purpose:shot.purpose ? String(shot.purpose) : null,
        audioStrategy:String(shot.audioStrategy||"none"),
      },
      technical:technical || null,
    };

    const {stdout}=await runWorker(
      String(python),
      [localWorkerPath],
      payload,
      {spawnImpl,timeoutMs},
    );
    const result=parseWorkerResponse(stdout);
    const evidence={
      schema:"sauceapproved.hercules.video-semantic-evaluation-evidence",
      version:1,
      evaluatorId:"qwen3-vl-4b-instruct-local",
      modelId:MODEL_ID,
      modelRevision:modelEvidence.revision,
      modelManifestFingerprint:modelEvidence.manifestFingerprint,
      videoSha256:String(artifact.sha256||""),
      shotId:String(shot.id),
      sampledFps:fps,
      notes:result.notes,
      scores:result.scores,
    };
    return {
      ...result.scores,
      evidence:{...evidence,fingerprint:fingerprint(evidence)},
    };
  };

  Object.defineProperties(evaluate,{
    herculesSemanticEvaluator:{value:true,enumerable:false},
    evaluatorId:{value:"qwen3-vl-4b-instruct-local",enumerable:false},
    modelId:{value:MODEL_ID,enumerable:false},
    health:{value:async()=>({
      ok:true,
      evaluatorId:"qwen3-vl-4b-instruct-local",
      modelEvidence:await ensureReady(),
    }),enumerable:false},
  });
  return evaluate;
}
