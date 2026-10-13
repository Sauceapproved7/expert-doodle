// Hercules owner-host Qwen 1.5B private trial preflight. No public release authority.
import {createReadStream} from "node:fs";
import {stat,access,readFile} from "node:fs/promises";
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


const CGROUP_PATHS=Object.freeze({
  memoryMax:"/sys/fs/cgroup/memory.max",
  memoryCurrent:"/sys/fs/cgroup/memory.current",
  cpuMax:"/sys/fs/cgroup/cpu.max",
  v1MemoryLimit:"/sys/fs/cgroup/memory/memory.limit_in_bytes",
  v1MemoryUsage:"/sys/fs/cgroup/memory/memory.usage_in_bytes",
  v1CpuQuota:"/sys/fs/cgroup/cpu/cpu.cfs_quota_us",
  v1CpuPeriod:"/sys/fs/cgroup/cpu/cpu.cfs_period_us",
});

function decimalInteger(text,{allowZero=false}={}){
  if(typeof text!=="string"||!/^\d+$/.test(text.trim()))return null;
  try{
    const val=BigInt(text.trim());
    if(val<BigInt(allowZero?0:1)||val>BigInt(Number.MAX_SAFE_INTEGER))return null;
    return Number(val);
  }catch{return null;}
}

export function parseQwen15CgroupLimits(raw={}){
  const e=raw??{};
  const present=key=>typeof e[key]==="string";
  const result={cgroupMemoryLimitBytes:null,cgroupMemoryCurrentBytes:null,
    cgroupCpuCapacity:null,cgroupInvalid:false};
  let maxText,usedText;
  if(present("memoryMax")){
    maxText=e.memoryMax.trim();
    usedText=e.memoryCurrent;
  }else if(present("v1MemoryLimit")){
    maxText=e.v1MemoryLimit.trim();
    usedText=e.v1MemoryUsage;
    if(/^\d+$/.test(maxText)){
      try{if(BigInt(maxText)>=1n<<60n)maxText="max";}catch{}
    }
  }
  if(maxText!==undefined&&maxText!=="max"){
    const cap=decimalInteger(maxText);
    const used=decimalInteger(usedText,{allowZero:true});
    if(cap===null||used===null||used>cap)result.cgroupInvalid=true;
    else {
      result.cgroupMemoryLimitBytes=cap;
      result.cgroupMemoryCurrentBytes=used;
    }
  }else if(maxText==="max"){
    // Unlimited cgroups may expose 'current' but impose no memory ceiling.
    if(usedText!==undefined && decimalInteger(usedText,{allowZero:true})===null)
      result.cgroupInvalid=true;
  }
  if(present("cpuMax")){
    const parts=e.cpuMax.trim().split(/\s+/);
    if(parts.length!==2)result.cgroupInvalid=true;
    else{
      const period=decimalInteger(parts[1]);
      if(period===null)result.cgroupInvalid=true;
      else if(parts[0]!=="max"){
        const quota=decimalInteger(parts[0]);
        if(quota===null)result.cgroupInvalid=true;
        else result.cgroupCpuCapacity=quota/period;
      }
    }
  }else if(present("v1CpuQuota")||present("v1CpuPeriod")){
    const quota=e.v1CpuQuota?.trim();
    const period=decimalInteger(e.v1CpuPeriod);
    if(!quota||period===null)result.cgroupInvalid=true;
    else if(quota!=="-1"){
      const q=decimalInteger(quota);
      if(q===null)result.cgroupInvalid=true;
      else result.cgroupCpuCapacity=q/period;
    }
  }
  return Object.freeze(result);
}

async function readQwen15CgroupLimits(readImpl=readFile){
  const raw={};
  let invalidRead=false;
  for(const [key,path] of Object.entries(CGROUP_PATHS)){
    try{
      const contents=await readImpl(path,"utf8");
      if(typeof contents!=="string")invalidRead=true;
      else raw[key]=contents;
    }catch(error){
      if(error?.code!=="ENOENT")invalidRead=true;
    }
  }
  const parsed=parseQwen15CgroupLimits(raw);
  return Object.freeze({
    ...parsed,
    cgroupInvalid:parsed.cgroupInvalid||invalidRead
  });
}

export function assessQwen15OwnerHost(evidence){
  const e=evidence??{};
  const arm=e.arch==="arm64";
  const effectiveCpuCount=Math.min(
    Number.isInteger(e.cpuCount)?e.cpuCount:0,
    Number.isFinite(e.cgroupCpuCapacity)?e.cgroupCpuCapacity:Infinity
  );
  const effectiveTotalMemBytes=Math.min(
    Number.isSafeInteger(e.totalMemBytes)?e.totalMemBytes:0,
    Number.isSafeInteger(e.cgroupMemoryLimitBytes)&&e.cgroupMemoryLimitBytes>0?
      e.cgroupMemoryLimitBytes:Infinity
  );
  const cgroupRemaining=Number.isSafeInteger(e.cgroupMemoryLimitBytes)&&
      Number.isSafeInteger(e.cgroupMemoryCurrentBytes)?
      Math.max(0,e.cgroupMemoryLimitBytes-e.cgroupMemoryCurrentBytes):Infinity;
  const effectiveFreeMemBytes=Math.min(
    Number.isSafeInteger(e.freeMemBytes)?e.freeMemBytes:0,
    cgroupRemaining
  );
  const enoughCpus=effectiveCpuCount>=2;
  const total=effectiveTotalMemBytes>=MIN_TOTAL_BYTES;
  const free=effectiveFreeMemBytes>=MIN_FREE_BYTES;
  const size=Number.isSafeInteger(e.modelBytes)&&
    e.modelBytes>=MIN_MODEL_BYTES&&e.modelBytes<=MAX_MODEL_BYTES;
  const sha=e.modelSha256===QWEN15_SHA256;
  const binary=e.engineBinaryExecutable===true;
  const modelFile=e.modelFileRegular===true;
  const validCgroup=e.cgroupInvalid!==true;
  const reasons=[
    ...(!arm?["requires_native_arm64"]:[]),
    ...(!validCgroup?["container_quota_unverifiable"]:[]),
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
    effectiveTotalMemBytes,effectiveFreeMemBytes,effectiveCpuCount,
    containerQuotaVerified:validCgroup,
    pinnedModelHashVerified:sha,
    hardwareCompatibleForPrivateTrial:reasons.length===0,
    reasons:Object.freeze(reasons),
    // System/cgroup resources do NOT prove host ownership, billing or release.
    hostOwnershipVerified:false,ownerBillingVerified:false,
    productionInferenceVerified:false,publicReleaseApproved:false,
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

export async function inspectQwen15LocalHost({modelPath,engineBinary,systemProbe,cgroupRead}={}){
  const model=fixedAbsoluteFilePath(modelPath);
  const binary=fixedAbsoluteFilePath(engineBinary);
  const probe=typeof systemProbe==="function"?systemProbe:()=>({
    arch:arch(),cpuCount:availableParallelism(),
    totalMemBytes:totalmem(),freeMemBytes:freemem()
  });
  const local=probe();
  const cgroup=await readQwen15CgroupLimits(cgroupRead);
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
    ...cgroup,
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
