// Resource-only diagnostics for an ephemeral public GitHub ARM64 runner.
// Prints no environment variables, credentials, private model data, or prompt.
import {readFile} from "node:fs/promises";
import {arch,availableParallelism,totalmem,freemem} from "node:os";
import {deriveQwen15CgroupBudget,readQwen15CgroupBudget} from "../hercules-models/qwen15-owner-host.mjs";
const paths=[
  "/sys/fs/cgroup/memory.max",
  "/sys/fs/cgroup/memory.current",
  "/sys/fs/cgroup/cpu.max",
  "/sys/fs/cgroup/memory/memory.limit_in_bytes",
  "/sys/fs/cgroup/memory/memory.usage_in_bytes",
  "/sys/fs/cgroup/cpu/cpu.cfs_quota_us",
  "/sys/fs/cgroup/cpu/cpu.cfs_period_us"
];
const entries=await Promise.all(paths.map(async p=>{
  try{return [p,(await readFile(p,"utf8")).trim().slice(0,60)];}
  catch(e){return [p,e?.code==="ENOENT"?null:"unreadable"];}
}));
const files=Object.fromEntries(entries);
const host={arch:arch(),cpuCount:availableParallelism(),totalMemBytes:totalmem(),freeMemBytes:freemem()};
const derived=deriveQwen15CgroupBudget(host,files);
const scopedDerived=await readQwen15CgroupBudget(host);
const procData={};
for(const p of ["/proc/self/cgroup","/proc/1/cgroup","/proc/1/comm"]){
  try{procData[p]=(await readFile(p,"utf8")).trim().slice(0,240);}
  catch{procData[p]="unavailable";}
}
try{
  const mountinfo=await readFile("/proc/self/mountinfo","utf8");
  procData.mountCgroupEntries=mountinfo.split("\n")
    .filter(line=>/\s-\s(cgroup|cgroup2)\s/.test(line)||line.includes(" /sys/fs/cgroup "))
    .slice(0,10).map(line=>line.slice(0,280));
}catch{procData.mountCgroupEntries=["unavailable"];}

const scoped={};
const id=procData["/proc/self/cgroup"]?.split("\n").find(l=>l.startsWith("0::"))?.slice(3);
if(id?.startsWith("/")&&!id.split("/").includes("..")){
  const candidate="/sys/fs/cgroup"+id;
  for(const name of ["memory.max","memory.current","cpu.max","cgroup.controllers"]){
    try{scoped[name]=(await readFile(candidate+"/"+name,"utf8")).trim().slice(0,120);}
    catch(e){scoped[name]=e?.code==="ENOENT"?null:"unreadable";}
  }
}
process.stdout.write(JSON.stringify({
  schema:"hercules.qwen15.ephemeral-arm-cgroup-observation.v1",
  host,detectedControllerValues:files,derived,scopedDerived,procData,scopedControllerValues:scoped,
  productionInferenceVerified:false,
  hostOwnershipVerified:false,
  ownerBillingVerified:false,
  publicReleaseApproved:false
})+"\n");
if(!scopedDerived.cgroupInspectionOk)process.exitCode=2;
