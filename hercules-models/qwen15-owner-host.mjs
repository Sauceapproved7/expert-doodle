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

// Linux CPU and memory controllers enforce container limits independent of os.*.
// A missing/malformed controller fails closed; no claim of provider host ownership.
const V2={
  limit:"/sys/fs/cgroup/memory.max",
  used:"/sys/fs/cgroup/memory.current",
  cpu:"/sys/fs/cgroup/cpu.max"
};
const V1={
  limit:"/sys/fs/cgroup/memory/memory.limit_in_bytes",
  used:"/sys/fs/cgroup/memory/memory.usage_in_bytes",
  quota:"/sys/fs/cgroup/cpu/cpu.cfs_quota_us",
  period:"/sys/fs/cgroup/cpu/cpu.cfs_period_us"
};
const CGROUP_PATHS=Object.freeze([...Object.values(V2),...Object.values(V1)]);

function bytes(text,{unlimited=false}={}){
  if(typeof text!=="string")return Number.NaN;
  const value=text.trim();
  if(value==="max"&&unlimited)return Infinity;
  if(!/^\d+$/.test(value))return Number.NaN;
  try{
    const n=BigInt(value);
    // Legacy v1 uses giant near-LONG_MAX constants to mean unlimited.
    if(unlimited&&n>BigInt(Number.MAX_SAFE_INTEGER))return Infinity;
    return n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):Number.NaN;
  }catch{return Number.NaN;}
}
function cpuV2(text){
  if(typeof text!=="string")return Number.NaN;
  const parts=text.trim().split(/\s+/);
  if(parts.length!==2)return Number.NaN;
  const period=bytes(parts[1]);
  if(!Number.isSafeInteger(period)||period<=0)return Number.NaN;
  if(parts[0]==="max")return Infinity;
  const quota=bytes(parts[0]);
  return Number.isSafeInteger(quota)&&quota>0?quota/period:Number.NaN;
}
function cpuV1(quotaText,periodText){
  if(typeof quotaText!=="string")return Number.NaN;
  const period=bytes(periodText);
  if(!Number.isSafeInteger(period)||period<=0)return Number.NaN;
  if(quotaText.trim()==="-1")return Infinity;
  const quota=bytes(quotaText);
  return Number.isSafeInteger(quota)&&quota>0?quota/period:Number.NaN;
}
const present=x=>typeof x==="string";

export function deriveQwen15CgroupBudget(host,files={}){
  const all=files??{};
  const v2=Object.values(V2).some(p=>present(all[p]));
  const v1=!v2&&Object.values(V1).some(p=>present(all[p]));
  let limit=Number.NaN,usage=Number.NaN,cpu=Number.NaN;
  const mode=v2?"v2":v1?"v1":"unavailable";
  if(v2){
    limit=bytes(all[V2.limit],{unlimited:true});
    usage=limit===Infinity?0:bytes(all[V2.used]);
    cpu=cpuV2(all[V2.cpu]);
  }else if(v1){
    limit=bytes(all[V1.limit],{unlimited:true});
    usage=limit===Infinity?0:bytes(all[V1.used]);
    cpu=cpuV1(all[V1.quota],all[V1.period]);
  }
  const validLimit=limit===Infinity||(Number.isSafeInteger(limit)&&limit>0);
  const validUsed=Number.isSafeInteger(usage)&&usage>=0;
  const validCpu=cpu===Infinity||(Number.isFinite(cpu)&&cpu>0);
  const inspected=(v2||v1)&&validLimit&&validUsed&&validCpu;
  const physicalCpu=host?.cpuCount;
  const physicalTotal=host?.totalMemBytes;
  const physicalFree=host?.freeMemBytes;
  const boundedCpu=inspected?Math.min(physicalCpu,cpu):0;
  const boundedTotal=inspected?Math.min(physicalTotal,limit):0;
  const boundedAvailable=inspected?
    Math.min(physicalFree,limit===Infinity?physicalFree:Math.max(0,limit-usage)):0;
  return Object.freeze({
    cgroupMode:mode,cgroupInspectionOk:inspected,
    cpuCount:boundedCpu,totalMemBytes:boundedTotal,
    freeMemBytes:boundedAvailable
  });
}

async function readCgroupText(path){
  try{return await readFile(path,"utf8");}
  catch(error){
    if(error?.code==="ENOENT")return null;
    // Unexpected I/O errors are not equivalent to "unlimited".
    return "unreadable";
  }
}
// /sys/fs/cgroup is a mount root, not necessarily the calling process's
// cgroup. Resolve the kernel's actual process cgroup path before reading
// quota files, and include parent cgroups that can enforce stricter limits.
export function resolveQwen15ScopedCgroupDirs(procText,mountInfoText){
  if(typeof procText!=="string"||typeof mountInfoText!=="string")return null;
  const record=procText.split(/\r?\n/).find(x=>x.startsWith("0::"));
  if(!record)return null;
  const current=record.slice(3).trim();
  if(!current.startsWith("/")||current.includes("\\")||
     current.includes("%")||current.includes("\0")||
     current.split("/").some(x=>x===".."||x==="."))return null;
  const lines=mountInfoText.split(/\r?\n/);
  let mountRoot=null,mountPoint=null;
  for(const line of lines){
    const parts=line.split(" - ");
    if(parts.length!==2||parts[1].split(/\s+/)[0]!=="cgroup2")continue;
    const fields=parts[0].split(/\s+/);
    if(fields.length<5||fields[4]!=="/sys/fs/cgroup")continue;
    mountRoot=fields[3];mountPoint=fields[4];break;
  }
  if(!mountPoint||!mountRoot||!mountRoot.startsWith("/")||
     mountRoot.includes("\\")||mountRoot.includes("%")||
     mountRoot.split("/").some(x=>x===".."||x==="."))return null;
  if(mountRoot!=="/"&&current!==mountRoot&&!current.startsWith(mountRoot+"/"))
    return null;
  const relative=mountRoot==="/"?current.slice(1):current.slice(mountRoot.length).replace(/^\//,"");
  const components=relative?relative.split("/"):[];
  if(components.some(x=>!x||x===".."||x==="."||x.includes("\\")||x.includes("%")))return null;
  const dirs=[mountPoint];
  let sofar=mountPoint;
  for(const part of components){
    sofar+="/"+part;
    dirs.push(sofar);
    if(dirs.length>32)return null;
  }
  return Object.freeze(dirs);
}
const invalidScopedBudget=()=>Object.freeze({
  cgroupMode:"v2_scoped",cgroupInspectionOk:false,
  cpuCount:0,totalMemBytes:0,freeMemBytes:0
});
async function readScopedBudget(host,dirs,reader){
  if(!Array.isArray(dirs)||!dirs.length)return invalidScopedBudget();
  const out={...host};
  let seen=false;
  for(const [index,dir] of dirs.entries()){
    const entries=await Promise.all([
      ["limit",V2.limit],["used",V2.used],["cpu",V2.cpu]
    ].map(async ([name,p])=>{
      const leaf=p.slice("/sys/fs/cgroup/".length);
      try{return [name,await reader(dir+"/"+leaf)];}
      catch{return [name,"unreadable"];}
    }));
    const fields=Object.fromEntries(entries);
    if(!Object.values(fields).some(present)){
      // Kernel cgroup2 mount root often has no memory.max/cpu.max.
      // Non-root leaf and parent cgroups must still be inspectable.
      if(index===0)continue;
      return invalidScopedBudget();
    }
    const limit=deriveQwen15CgroupBudget(host,{
      [V2.limit]:fields.limit,[V2.used]:fields.used,[V2.cpu]:fields.cpu
    });
    if(!limit.cgroupInspectionOk)return invalidScopedBudget();
    out.cpuCount=Math.min(out.cpuCount,limit.cpuCount);
    out.totalMemBytes=Math.min(out.totalMemBytes,limit.totalMemBytes);
    out.freeMemBytes=Math.min(out.freeMemBytes,limit.freeMemBytes);
    seen=true;
  }
  if(!seen)return invalidScopedBudget();
  return Object.freeze({
    cgroupMode:"v2_scoped",cgroupInspectionOk:true,
    cpuCount:out.cpuCount,totalMemBytes:out.totalMemBytes,
    freeMemBytes:out.freeMemBytes
  });
}
export async function readQwen15CgroupBudget(host,reader=readCgroupText){
  const entries=await Promise.all(CGROUP_PATHS.map(async path=>{
    try{return [path,await reader(path)];}
    catch{return [path,"unreadable"];}
  }));
  const staticFiles=Object.fromEntries(entries);
  // Prefer scoped v2 to mount-root files. A permissive root would otherwise
  // mask a 512MiB/0.1-CPU restriction on a nested process cgroup.
  let proc=null,mount=null;
  try{proc=await reader("/proc/self/cgroup");}
  catch{proc="unreadable";}
  try{mount=await reader("/proc/self/mountinfo");}
  catch{mount="unreadable";}
  if(present(proc)||present(mount)){
    const dirs=resolveQwen15ScopedCgroupDirs(proc,mount);
    if(dirs)return readScopedBudget(host,dirs,reader);
    // If the kernel reports a v2 controller mount but its path cannot be
    // validated, do not fall back to physical host specs.
    return invalidScopedBudget();
  }
  // Supports synthetic tests and legacy v1 hosts without a cgroup2 mount.
  return deriveQwen15CgroupBudget(host,staticFiles);
}

export function assessQwen15OwnerHost(evidence){
  const e=evidence??{};
  const arm=e.arch==="arm64";
  const cgroupsVerified=e.cgroupInspectionOk!==false;
  const enoughCpus=Number.isFinite(e.cpuCount)&&e.cpuCount>=2;
  const total=Number.isSafeInteger(e.totalMemBytes)&&e.totalMemBytes>=MIN_TOTAL_BYTES;
  const free=Number.isSafeInteger(e.freeMemBytes)&&e.freeMemBytes>=MIN_FREE_BYTES;
  const size=Number.isSafeInteger(e.modelBytes)&&e.modelBytes>=MIN_MODEL_BYTES&&e.modelBytes<=MAX_MODEL_BYTES;
  const sha=e.modelSha256===QWEN15_SHA256;
  const binary=e.engineBinaryExecutable===true;
  const modelFile=e.modelFileRegular===true;
  const reasons=[
    ...(!arm?["requires_native_arm64"]:[]),
    ...(!cgroupsVerified?["container_resource_inspection_failed"]:[]),
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

export async function inspectQwen15LocalHost({modelPath,engineBinary,systemProbe,cgroupReadText}={}){
  const model=fixedAbsoluteFilePath(modelPath);
  const binary=fixedAbsoluteFilePath(engineBinary);
  const probe=typeof systemProbe==="function"?systemProbe:()=>({
    arch:arch(),cpuCount:availableParallelism(),
    totalMemBytes:totalmem(),freeMemBytes:freemem()
  });
  const local=probe();
  const budget=await readQwen15CgroupBudget(local,cgroupReadText);
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
    arch:local.arch,...budget,
    modelBytes:modelStat.size,modelSha256:sha,
    engineBinaryExecutable:executable,modelFileRegular
  });
}

// A llama.cpp /health 200 alone is not evidence that the expected pinned
// model alias is loaded. Perform BOTH checks before exposing Hercules API.
// This proves only private engine readiness, never weight ownership, billing,
// Devbrain reachability or production release.
export async function probeQwen15EngineIdentity({fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=="function")return false;
  async function getExactJson(path){
    const result=await fetchImpl("http://127.0.0.1:18776"+path,{
      method:"GET",headers:{accept:"application/json"},
      redirect:"error",cache:"no-store",signal:AbortSignal.timeout(1500)
    });
    if(!result?.ok||result.status!==200)return null;
    const body=await result.json();
    return body&&typeof body==="object"&&!Array.isArray(body)?body:null;
  }
  try{
    const health=await getExactJson("/health");
    if(!health||health.status!=="ok"||Object.hasOwn(health,"error"))return false;
    const inventory=await getExactJson("/v1/models");
    return inventory?.object==="list"&&
      Array.isArray(inventory.data)&&inventory.data.length===1&&
      inventory.data[0]?.id===QWEN15_MODEL_ALIAS;
  }catch{return false;}
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
