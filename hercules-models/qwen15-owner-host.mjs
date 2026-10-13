// Hercules owner-host Qwen 1.5B private trial preflight. No public release authority.
import {createReadStream} from "node:fs";
import {stat,access} from "node:fs/promises";
import {constants} from "node:fs";
import {createHash} from "node:crypto";
import {arch,availableParallelism,totalmem,freemem} from "node:os";
import {isAbsolute,sep} from "node:path";

export const QWEN15_SHA256="1adf0b11065d8ad2e8123ea110d1ec956dab4ab038eab665614adba04b6c3370";
export const QWEN15_MODEL_ALIAS="hercules-15b-arm-trial";
const GiB=1024**3;
const MIN_TOTAL_BYTES=4*GiB;
const MIN_FREE_BYTES=2*GiB;
const MIN_MODEL_BYTES=900000000;
const MAX_MODEL_BYTES=1050000000;
const HOST="127.0.0.1";

export function assessQwen15OwnerHost(evidence){
  const e=evidence??{};
  const arm=e.arch==="arm64";
  const enoughCpus=Number.isInteger(e.cpuCount)&&e.cpuCount>=2;
  const total=Number.isSafeInteger(e.totalMemBytes)&&e.totalMemBytes>=MIN_TOTAL_BYTES;
  const free=Number.isSafeInteger(e.freeMemBytes)&&e.freeMemBytes>=MIN_FREE_BYTES;
  const size=Number.isSafeInteger(e.modelBytes)&&e.modelBytes>=MIN_MODEL_BYTES&&e.modelBytes<=MAX_MODEL_BYTES;
  const sha=e.modelSha256===QWEN15_SHA256;
  const binary=e.engineBinaryExecutable===true;
  const modelFile=e.modelFileRegular===true;
  const reasons=[
    ...(!arm?["requires_native_arm64"]:[]),
    ...(!enoughCpus?["requires_two_available_cpus"]:[]),
    ...(!total?["requires_four_gib_total_ram"]:[]),
    ...(!free?["requires_two_gib_available_ram"]:[]),
    ...(!modelFile?["model_file_not_regular"]:[]),
    ...(!size?["model_file_size_invalid"]:[]),
    ...(!sha?["pinned_model_digest_not_verified"]:[]),
    ...(!binary?["local_engine_not_executable"]:[])
  ];
  return Object.freeze({
    schema:"hercules.qwen15.owner-host-preflight.v1",
    requiredRamGiB:4,requiredAvailableRamGiB:2,
    pinnedModelHashVerified:sha,
    hardwareCompatibleForPrivateTrial:reasons.length===0,
    reasons:Object.freeze(reasons),
    // Local resource checks DO NOT prove connected hosting, billing, ownership
    // or any quality/safety/availability/production authorization.
    hostOwnershipVerified:false,
    ownerBillingVerified:false,
    productionInferenceVerified:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false
  });
}

function fixedAbsoluteFilePath(path){
  if(typeof path!=="string"||!isAbsolute(path)||path.includes("\0")||
    path.split(sep).includes("..")||path.trim()!==path||path.length>4096){
    throw new TypeError("absolute local model/engine path required");
  }
  return path;
}

async function hashModel(path){
  const sha=createHash("sha256");
  for await (const chunk of createReadStream(path)){sha.update(chunk);}
  return sha.digest("hex");
}

export async function inspectQwen15LocalHost({modelPath,engineBinary,systemProbe}={}){
  const model=fixedAbsoluteFilePath(modelPath);
  const binary=fixedAbsoluteFilePath(engineBinary);
  const probe=typeof systemProbe==="function"?systemProbe:()=>({
    arch:arch(),cpuCount:availableParallelism(),
    totalMemBytes:totalmem(),freeMemBytes:freemem()
  });
  const local=probe();
  const modelStat=await stat(model);
  const modelFileRegular=modelStat.isFile();
  let executable=false;
  try{
    const engineStat=await stat(binary);
    if(engineStat.isFile()){
      await access(binary,constants.X_OK);
      executable=true;
    }
  }catch{}
  const sha=modelFileRegular?await hashModel(model):null;
  return Object.freeze({
    arch:local.arch,cpuCount:local.cpuCount,
    totalMemBytes:local.totalMemBytes,freeMemBytes:local.freeMemBytes,
    modelBytes:modelStat.size,modelSha256:sha,
    engineBinaryExecutable:executable,modelFileRegular
  });
}

export function makeQwen15PrivateLaunchPlan({enabled=false,token,modelPath,engineBinary,hostEvidence}={}){
  if(enabled!==true)throw new Error("owner_private_trial_disabled");
  if(typeof token!=="string"||token.length<32||token.length>512||
    /[\s\0]/.test(token))throw new TypeError("strong owner-only bearer token required");
  const model=fixedAbsoluteFilePath(modelPath);
  const binary=fixedAbsoluteFilePath(engineBinary);
  const checked=assessQwen15OwnerHost(hostEvidence);
  if(!checked.hardwareCompatibleForPrivateTrial)throw new Error("owner_host_preflight_failed");
  return Object.freeze({
    host:HOST,port:18776,controlHost:HOST,controlPort:38900,
    modelAlias:QWEN15_MODEL_ALIAS,engineBinary:binary,
    args:Object.freeze([
      "--model",model,"--alias",QWEN15_MODEL_ALIAS,
      "--host",HOST,"--port","18776",
      "--ctx-size","1024","--parallel","1","--threads","2","--no-webui"
    ]),
    localChatProtocol:"llama-cpp",enablePrivateChat:true,
    productionInferenceVerified:false,publicReleaseApproved:false,
    paidCommerceEnabled:false
  });
}
