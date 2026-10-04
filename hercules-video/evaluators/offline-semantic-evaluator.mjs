import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {stat} from "node:fs/promises";
import {createHash} from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value==="object") return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}
function score(value,name) {
  const number=Number(value);
  if (!Number.isFinite(number)||number<0||number>1) throw new Error("offline_evaluator_score_invalid:"+name);
  return number;
}
function parse(stdout) {
  let value;
  try { value=JSON.parse(String(stdout||"").trim()); } catch { throw new Error("offline_evaluator_worker_json_invalid"); }
  if (value?.ok!==true||!value.scores||typeof value.scores!=="object") throw new Error("offline_evaluator_worker_failed");
  const scores={};
  for (const name of ["promptAdherence","temporalConsistency","visualQuality","brandConsistency","artifactFreedom","reliability"]) scores[name]=score(value.scores[name],name);
  return {scores,notes:Array.isArray(value.notes)?value.notes.map(v=>String(v).slice(0,500)).slice(0,12):[]};
}
export function createOfflineSemanticEvaluator({
  evaluatorId,command,args=[],readiness,spawnImpl=spawn,statImpl=stat,timeoutMs=600000,
}={}) {
  const id=String(evaluatorId||"").trim();
  if (!id) throw new Error("offline_evaluator_id_required");
  if (!String(command||"").trim()) throw new Error("offline_evaluator_command_required");
  if (!Array.isArray(args)) throw new Error("offline_evaluator_args_required");
  if (typeof readiness!=="function") throw new Error("offline_evaluator_readiness_required");
  if (!Number.isInteger(timeoutMs)||timeoutMs<=0) throw new Error("offline_evaluator_timeout_invalid");

  return async function evaluate({shot,artifact}={}) {
    if (!shot||!artifact) throw new Error("offline_evaluator_context_required");
    const uri=String(artifact.uri||"");
    if (!uri.startsWith("file://")) throw new Error("offline_evaluator_local_media_required");
    const mediaPath=fileURLToPath(uri);
    const info=await statImpl(mediaPath).catch(()=>null);
    if (!info?.isFile()||info.size<=0) throw new Error("offline_evaluator_media_missing");
    const model=await readiness();
    if (!model?.modelId||!model?.revision||!/^[a-f0-9]{64}$/.test(String(model.manifestFingerprint||""))) throw new Error("offline_evaluator_verified_readiness_required");

    const payload={schema:"sauceapproved.hercules.video-offline-semantic-request",version:1,evaluatorId:id,modelId:String(model.modelId),modelRevision:String(model.revision),mediaUri:uri,shot:{id:String(shot.id||""),prompt:String(shot.prompt||"")}};
    const output=await new Promise((resolve,reject)=>{
      const child=spawnImpl(String(command),args.map(String),{stdio:["pipe","pipe","pipe"],shell:false,env:{...process.env,HF_HUB_OFFLINE:"1",TRANSFORMERS_OFFLINE:"1"}});
      let stdout="",stderr="",settled=false;
      const timer=setTimeout(()=>{if(settled)return;settled=true;child.kill("SIGTERM");reject(new Error("offline_evaluator_timeout"));},timeoutMs);
      child.stdout?.on("data",c=>stdout+=c.toString());
      child.stderr?.on("data",c=>stderr+=c.toString());
      child.once("error",e=>{if(settled)return;settled=true;clearTimeout(timer);reject(e);});
      child.once("close",code=>{if(settled)return;settled=true;clearTimeout(timer);code===0?resolve(stdout):reject(new Error("offline_evaluator_process_failed:"+stderr.slice(-1000)));});
      child.stdin?.end(JSON.stringify(payload));
    });
    const result=parse(output);
    const evidence={schema:"sauceapproved.hercules.video-semantic-evaluation-evidence",version:1,evaluatorId:id,modelId:String(model.modelId),modelRevision:String(model.revision),modelManifestFingerprint:String(model.manifestFingerprint),mediaSha256:String(artifact.sha256||""),shotId:String(shot.id||""),notes:result.notes,scores:result.scores};
    return {...result.scores,evidence:{...evidence,fingerprint:fingerprint(evidence)}};
  };
}
