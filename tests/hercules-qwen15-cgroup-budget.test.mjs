import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {QWEN15_SHA256,assessQwen15OwnerHost,deriveQwen15CgroupBudget,
  inspectQwen15LocalHost,resolveQwen15ScopedCgroupDirs} from "../hercules-models/qwen15-owner-host.mjs";

const GiB=1024**3;
const host={arch:"arm64",cpuCount:8,totalMemBytes:16*GiB,freeMemBytes:12*GiB};
const good={...host,modelBytes:990000000,modelSha256:QWEN15_SHA256,
  engineBinaryExecutable:true,modelFileRegular:true};
const v2=(max="max",current="0",cpu="max 100000")=>({
  "/sys/fs/cgroup/memory.max":max,
  "/sys/fs/cgroup/memory.current":current,
  "/sys/fs/cgroup/cpu.max":cpu
});
const v1=(max,current,quota,period="100000")=>({
  "/sys/fs/cgroup/memory/memory.limit_in_bytes":max,
  "/sys/fs/cgroup/memory/memory.usage_in_bytes":current,
  "/sys/fs/cgroup/cpu/cpu.cfs_quota_us":quota,
  "/sys/fs/cgroup/cpu/cpu.cfs_period_us":period
});
test("cgroup v2 limits override misleading physical host specs",()=>{
  const b=deriveQwen15CgroupBudget(host,v2(String(512*1024*1024),"131072000","10000 100000"));
  assert.equal(b.totalMemBytes,512*1024*1024);
  assert.equal(b.freeMemBytes,512*1024*1024-131072000);
  assert.equal(b.cpuCount,.1);
  assert.equal(b.cgroupMode,"v2");
  assert.equal(assessQwen15OwnerHost({...good,...b}).hardwareCompatibleForPrivateTrial,false);
});
test("cgroup v2 quota and available memory must each be sufficient",()=>{
  const goodHost=deriveQwen15CgroupBudget(host,v2(String(8*GiB),String(GiB),"250000 100000"));
  assert.equal(goodHost.cpuCount,2.5);
  assert.equal(goodHost.freeMemBytes,7*GiB);
  assert.equal(assessQwen15OwnerHost({...good,...goodHost}).hardwareCompatibleForPrivateTrial,true);
  for(const files of [
    v2(String(3*GiB),"0","400000 100000"),
    v2(String(8*GiB),String(7*GiB),"400000 100000"),
    v2(String(8*GiB),"0","150000 100000")
  ])assert.equal(assessQwen15OwnerHost({...good,...deriveQwen15CgroupBudget(host,files)}).hardwareCompatibleForPrivateTrial,false);
});
test("unlimited cgroups do not invent artificial limit",()=>{
  const b=deriveQwen15CgroupBudget(host,v2("max","0","max 100000"));
  assert.equal(b.totalMemBytes,host.totalMemBytes);
  assert.equal(b.freeMemBytes,host.freeMemBytes);
  assert.equal(b.cpuCount,host.cpuCount);
  assert.equal(b.cgroupMode,"v2");
});
test("legacy cgroup v1 memory and CPU controllers are obeyed",()=>{
  const b=deriveQwen15CgroupBudget(host,v1(String(2*GiB),String(GiB),"50000"));
  assert.equal(b.totalMemBytes,2*GiB);
  assert.equal(b.freeMemBytes,GiB);
  assert.equal(b.cpuCount,.5);
  assert.equal(assessQwen15OwnerHost({...good,...b}).hardwareCompatibleForPrivateTrial,false);
  const unlimited=deriveQwen15CgroupBudget(host,v1("9223372036854771712","0","-1"));
  assert.equal(unlimited.totalMemBytes,host.totalMemBytes);
  assert.equal(unlimited.cpuCount,host.cpuCount);
});
test("bad, missing or impossible values fail closed if the controller is present",()=>{
  const inputs=[
    v2("garbage","0","200000 100000"),
    v2("4294967296",null,"200000 100000"),
    v2("4294967296","bad","200000 100000"),
    v2("4294967296","100000","0 100000"),
    v2("4294967296","100000","invalid"),
    v2("4294967296","100000","200000 0"),
    v1("nope","100000","200000"),
    v1(String(8*GiB),null,"200000")
  ];
  for(const files of inputs){
    const b=deriveQwen15CgroupBudget(host,files);
    assert.equal(b.cgroupInspectionOk,false,JSON.stringify(files));
    assert.equal(assessQwen15OwnerHost({...good,...b}).hardwareCompatibleForPrivateTrial,false);
  }
});
test("real inspector enforces injected Linux container quota even when physical host says 16 GiB",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"hercules-cgroup-"));
  try{
    const modelPath=join(dir,"fake.gguf"),engineBinary=join(dir,"engine");
    await writeFile(modelPath,"fake-not-valid-gguf");
    await writeFile(engineBinary,"#!/bin/sh\nexit 0\n",{mode:0o700});
    const files=v2(String(512*1024*1024),"120000000","10000 100000");
    const evidence=await inspectQwen15LocalHost({
      modelPath,engineBinary,systemProbe:()=>host,
      cgroupReadText:async path=>files[path]??null
    });
    assert.equal(evidence.totalMemBytes,512*1024*1024);
    assert.equal(evidence.cpuCount,.1);
    assert.equal(evidence.cgroupMode,"v2");
    assert.equal(assessQwen15OwnerHost({...good,...evidence}).hardwareCompatibleForPrivateTrial,false);
  }finally{await rm(dir,{recursive:true,force:true})}
});
test("cgroup inspection uncertainty cannot be bypassed by plausible host memory",()=>{
  const r=assessQwen15OwnerHost({...good,cgroupInspectionOk:false});
  assert.equal(r.hardwareCompatibleForPrivateTrial,false);
  assert.ok(r.reasons.includes("container_resource_inspection_failed"));
});

const procCgroup="0::/system.slice/hosted-compute-agent.service\n";
const mountInfo="38 32 0:32 / /sys/fs/cgroup rw,nosuid,nodev,noexec,relatime shared:8 - cgroup2 cgroup2 rw,nsdelegate,memory_recursiveprot\n";
const scopedPath="/sys/fs/cgroup/system.slice/hosted-compute-agent.service";
test("resolve process cgroup v2 mount path safely; never read unrelated filesystem roots",()=>{
  assert.deepEqual(resolveQwen15ScopedCgroupDirs(procCgroup,mountInfo),[
    "/sys/fs/cgroup",
    "/sys/fs/cgroup/system.slice",
    scopedPath
  ]);
  for(const path of [
    "0::/../../tmp/secrets",
    "0::/system.slice/../secrets",
    "1:cpu:/system.slice/user",
    "0::/system.slice/hosted-compute-agent.service/../../other",
    "0::/system.slice/hosted-compute-agent.service%2F.."
  ])assert.equal(resolveQwen15ScopedCgroupDirs(path,mountInfo),null);
  assert.equal(resolveQwen15ScopedCgroupDirs(procCgroup,"no cgroup mount"),null);
  assert.equal(resolveQwen15ScopedCgroupDirs(procCgroup,
    "38 32 0:32 / /etc rw - cgroup2 cgroup2 rw"),null);
});
test("real inspector finds process-scoped cgroup with root controller files absent",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"hercules-scoped-cgroup-"));
  try{
    const modelPath=join(dir,"fake.gguf"),engineBinary=join(dir,"engine");
    await writeFile(modelPath,"fake-model-bytes");
    await writeFile(engineBinary,"#!/bin/sh\nexit 0\n",{mode:0o700});
    const files={
      "/proc/self/cgroup":procCgroup,
      "/proc/self/mountinfo":mountInfo,
      [scopedPath+"/memory.max"]:"max",
      [scopedPath+"/memory.current"]:String(GiB),
      [scopedPath+"/cpu.max"]:"max 100000",
      "/sys/fs/cgroup/system.slice/memory.max":"max",
      "/sys/fs/cgroup/system.slice/memory.current":String(GiB),
      "/sys/fs/cgroup/system.slice/cpu.max":"max 100000"
    };
    const e=await inspectQwen15LocalHost({
      modelPath,engineBinary,systemProbe:()=>host,
      cgroupReadText:async p=>files[p]??null
    });
    assert.equal(e.cgroupMode,"v2_scoped");
    assert.equal(e.cgroupInspectionOk,true);
    assert.equal(e.totalMemBytes,host.totalMemBytes);
    assert.equal(e.cpuCount,host.cpuCount);
    assert.equal(e.freeMemBytes,host.freeMemBytes);
  }finally{await rm(dir,{recursive:true,force:true})}
});
test("scoped parent quota trumps an unbounded leaf and root",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"hercules-cgroup-ancestor-"));
  try{
    const modelPath=join(dir,"fake.gguf"),engineBinary=join(dir,"engine");
    await writeFile(modelPath,"fake-model-bytes");
    await writeFile(engineBinary,"#!/bin/sh\nexit 0\n",{mode:0o700});
    const files={
      "/proc/self/cgroup":procCgroup,
      "/proc/self/mountinfo":mountInfo,
      [scopedPath+"/memory.max"]:"max",
      [scopedPath+"/memory.current"]:"0",
      [scopedPath+"/cpu.max"]:"max 100000",
      "/sys/fs/cgroup/system.slice/memory.max":String(512*1024*1024),
      "/sys/fs/cgroup/system.slice/memory.current":"65536000",
      "/sys/fs/cgroup/system.slice/cpu.max":"10000 100000"
    };
    const e=await inspectQwen15LocalHost({
      modelPath,engineBinary,systemProbe:()=>host,
      cgroupReadText:async p=>files[p]??null
    });
    assert.equal(e.cgroupMode,"v2_scoped");
    assert.equal(e.totalMemBytes,512*1024*1024);
    assert.equal(e.cpuCount,.1);
    assert.equal(assessQwen15OwnerHost({...good,...e}).hardwareCompatibleForPrivateTrial,false);
  }finally{await rm(dir,{recursive:true,force:true})}
});
