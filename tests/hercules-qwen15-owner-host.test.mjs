import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {
  QWEN15_SHA256,QWEN15_MODEL_ALIAS,
  assessQwen15OwnerHost,inspectQwen15LocalHost,
  makeQwen15PrivateLaunchPlan
} from "../hercules-models/qwen15-owner-host.mjs";

const GiB=1024**3;
const good={
  arch:"arm64",cpuCount:4,totalMemBytes:12*GiB,
  freeMemBytes:8*GiB,modelBytes:990000000,modelSha256:QWEN15_SHA256,
  engineBinaryExecutable:true,modelFileRegular:true
};
const token="T".repeat(64);

test("hardware proof cannot claim a real owned instance or commercial authorization",()=>{
  const r=assessQwen15OwnerHost(good);
  assert.equal(r.hardwareCompatibleForPrivateTrial,true);
  assert.equal(r.pinnedModelHashVerified,true);
  assert.equal(r.requiredRamGiB,4);
  assert.equal(r.productionInferenceVerified,false);
  assert.equal(r.ownerBillingVerified,false);
  assert.equal(r.hostOwnershipVerified,false);
  assert.equal(r.publicReleaseApproved,false);
  assert.equal(r.paidCommerceEnabled,false);
});

test("missing memory, CPU, architecture, model or executable block private trial",()=>{
  const cases=[
    null,{}, {...good,arch:"x64"},
    {...good,cpuCount:1},{...good,totalMemBytes:3*GiB},
    {...good,freeMemBytes:GiB},
    {...good,modelBytes:3000000},{...good,modelSha256:"0".repeat(64)},
    {...good,engineBinaryExecutable:false},{...good,modelFileRegular:false}
  ];
  for(const c of cases)assert.equal(assessQwen15OwnerHost(c).hardwareCompatibleForPrivateTrial,false);
});

test("owner-only local launch is opt in, loopback only, no network pull and no public qualification",()=>{
  const config={enabled:true,token,modelPath:"/opt/hercules/models/qwen15.gguf",
    engineBinary:"/opt/hercules/bin/llama-server",
    hostEvidence:good};
  const p=makeQwen15PrivateLaunchPlan(config);
  assert.equal(p.host,"127.0.0.1");
  assert.equal(p.port,18776);
  assert.equal(p.controlHost,"127.0.0.1");
  assert.equal(p.controlPort,38900);
  assert.equal(p.modelAlias,QWEN15_MODEL_ALIAS);
  assert.equal(p.enablePrivateChat,true);
  assert.equal(p.productionInferenceVerified,false);
  assert.equal(p.publicReleaseApproved,false);
  assert.equal(p.localChatProtocol,"llama-cpp");
  assert.ok(p.args.includes("--threads"));
  assert.ok(p.args.includes("2"));
  assert.ok(p.args.includes("--no-webui"));
  assert.deepEqual(p.args.slice(p.args.indexOf("--host")+1,p.args.indexOf("--host")+2),["127.0.0.1"]);
  assert.ok(!p.args.some(x=>/https?:|huggingface|curl|wget/i.test(x)));
  assert.doesNotMatch(JSON.stringify(p),new RegExp(token));
});

test("no strong owner token, explicit opt in, absolute paths or compatible hardware refuses startup",()=>{
  const goodConfig={enabled:true,token,modelPath:"/opt/hercules/models/qwen15.gguf",
    engineBinary:"/opt/hercules/bin/llama-server",hostEvidence:good};
  for(const c of [
    {...goodConfig,enabled:false},{...goodConfig,token:"abc"},
    {...goodConfig,modelPath:"./qwen.gguf"},
    {...goodConfig,modelPath:"/opt/../etc/secret"},
    {...goodConfig,engineBinary:"llama-server"},
    {...goodConfig,hostEvidence:{...good,arch:"x64"}}
  ])assert.throws(()=>makeQwen15PrivateLaunchPlan(c));
});

test("actual host inspector measures model bytes and sha256 instead of trusting a claimed hash",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"hercules-qwen15-host-"));
  try{
    const model=join(dir,"fake.gguf"),exe=join(dir,"llama-server");
    await writeFile(model,"fake-model-bytes");
    await writeFile(exe,"#!/bin/sh\nexit 0\n",{mode:0o700});
    const r=await inspectQwen15LocalHost({
      modelPath:model,engineBinary:exe,
      systemProbe:()=>({arch:"arm64",cpuCount:4,totalMemBytes:12*GiB,freeMemBytes:8*GiB})
    });
    assert.equal(r.modelSha256,createHash("sha256").update("fake-model-bytes").digest("hex"));
    assert.equal(r.modelBytes,16);
    assert.equal(r.engineBinaryExecutable,true);
    assert.equal(r.modelFileRegular,true);
    assert.equal(assessQwen15OwnerHost(r).hardwareCompatibleForPrivateTrial,false);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test("no auto-activation, no production model flag in the isolated bootstrap file",async()=>{
  const {readFile}=await import("node:fs/promises");
  const code=await readFile(new URL("../scripts/hercules-qwen15-owner-host.mjs",import.meta.url),"utf8");
  assert.match(code,/HERCULES_QWEN15_PRIVATE_TRIAL/);
  assert.match(code,/!==\s*"true"/);
  assert.match(code,/createLocalChatAdapter/);
  assert.match(code,/listenModelPlaneService/);
  assert.match(code,/127\.0\.0\.1/);
  assert.doesNotMatch(code,/listen\s*\(\s*[^,]+,\s*["']0\.0\.0\.0["']/);
  assert.doesNotMatch(code,/oci\s+compute\s+instance\s+launch|RENDER_API_KEY|OPENAI_API_KEY/);
});

test("private launcher refuses to start without explicit owner authorization",async()=>{
  const {spawnSync}=await import("node:child_process");
  const script=new URL("../scripts/hercules-qwen15-owner-host.mjs",import.meta.url);
  const result=spawnSync(process.execPath,[script.pathname],{
    encoding:"utf8",
    timeout:8000,
    env:{PATH:process.env.PATH||"/usr/bin:/bin"}
  });
  assert.equal(result.status,2);
  assert.match(result.stderr,/owner_private_trial_disabled/);
  assert.doesNotMatch(result.stdout,/privateTrial|ok/);
});

test("owner-code policy explicitly declares an external llama.cpp binary process boundary",async()=>{
  const {readFile}=await import("node:fs/promises");
  const policy=JSON.parse(await readFile(new URL("../governance/owner-code-policy.json",import.meta.url),"utf8"));
  const boundary=policy.childProcessBoundaries.find(x=>x.path==="scripts/hercules-qwen15-owner-host.mjs");
  assert.equal(boundary?.kind,"external-model-adapter");
  assert.deepEqual(boundary?.dependencies,["llama-cpp"]);
  const dependency=policy.externalInfrastructure.find(x=>x.id==="llama-cpp");
  assert.equal(dependency?.ownership,"third-party-model-infrastructure");
  assert.equal(dependency?.packagedAsHerculesCode,false);
});


test("container cgroup v2 limits override a large underlying host",async()=>{
  const {parseQwen15CgroupLimits}=await import("../hercules-models/qwen15-owner-host.mjs");
  const limits=parseQwen15CgroupLimits({
    memoryMax:"536870912\n",memoryCurrent:"134217728\n",cpuMax:"10000 100000\n"
  });
  const verdict=assessQwen15OwnerHost({...good,...limits});
  assert.equal(verdict.hardwareCompatibleForPrivateTrial,false);
  assert.ok(verdict.reasons.includes("requires_four_gib_total_ram"));
  assert.ok(verdict.reasons.includes("requires_two_available_cpus"));
  assert.equal(verdict.effectiveTotalMemBytes,536870912);
  assert.equal(verdict.effectiveCpuCount,0.1);
  assert.equal(verdict.productionInferenceVerified,false);
});

test("constrained available memory inside a large cgroup blocks launch",async()=>{
  const {parseQwen15CgroupLimits}=await import("../hercules-models/qwen15-owner-host.mjs");
  const limits=parseQwen15CgroupLimits({
    memoryMax:String(8*GiB),memoryCurrent:String(7*GiB),
    cpuMax:"200000 100000"
  });
  const verdict=assessQwen15OwnerHost({...good,...limits});
  assert.equal(verdict.hardwareCompatibleForPrivateTrial,false);
  assert.ok(verdict.reasons.includes("requires_two_gib_available_ram"));
  assert.equal(verdict.effectiveFreeMemBytes,GiB);
});

test("unlimited cgroup v2, valid small quotas, and v1 memory/cpu data parse correctly",async()=>{
  const {parseQwen15CgroupLimits}=await import("../hercules-models/qwen15-owner-host.mjs");
  const unlimited=parseQwen15CgroupLimits({
    memoryMax:"max",memoryCurrent:"0",cpuMax:"max 100000"
  });
  assert.equal(unlimited.cgroupInvalid,false);
  assert.equal(unlimited.cgroupMemoryLimitBytes,null);
  assert.equal(unlimited.cgroupCpuCapacity,null);
  const v1=parseQwen15CgroupLimits({
    v1MemoryLimit:"1073741824",v1MemoryUsage:"536870912",
    v1CpuQuota:"50000",v1CpuPeriod:"100000"
  });
  assert.equal(v1.cgroupMemoryLimitBytes,GiB);
  assert.equal(v1.cgroupMemoryCurrentBytes,GiB/2);
  assert.equal(v1.cgroupCpuCapacity,0.5);
  assert.equal(assessQwen15OwnerHost({...good,...v1}).hardwareCompatibleForPrivateTrial,false);
  const unlimitedV1=parseQwen15CgroupLimits({
    v1MemoryLimit:"9223372036854771712",v1MemoryUsage:"1234",
    v1CpuQuota:"-1",v1CpuPeriod:"100000"
  });
  assert.equal(unlimitedV1.cgroupMemoryLimitBytes,null);
  assert.equal(unlimitedV1.cgroupCpuCapacity,null);
});

test("malformed or incomplete cgroup limits fail closed; absent limits allow bare metal",async()=>{
  const {parseQwen15CgroupLimits}=await import("../hercules-models/qwen15-owner-host.mjs");
  for(const x of [
    {memoryMax:"abc",memoryCurrent:"0"},
    {memoryMax:"4294967296"},
    {memoryMax:"4294967296",memoryCurrent:"5000000000"},
    {memoryMax:"4294967296",memoryCurrent:"-1"},
    {memoryMax:"4294967296",memoryCurrent:"0",cpuMax:"garbage"},
    {cpuMax:"1 0"},
    {v1MemoryLimit:"4294967296",v1MemoryUsage:"oops"},
    {v1CpuQuota:"100000",v1CpuPeriod:"-1"}
  ]){
    const r=parseQwen15CgroupLimits(x);
    assert.equal(r.cgroupInvalid,true,JSON.stringify(x));
    assert.equal(assessQwen15OwnerHost({...good,...r}).hardwareCompatibleForPrivateTrial,false);
  }
  const bareMetal=parseQwen15CgroupLimits({});
  assert.equal(bareMetal.cgroupInvalid,false);
  assert.equal(assessQwen15OwnerHost({...good,...bareMetal}).hardwareCompatibleForPrivateTrial,true);
});

test("inspector reads actual cgroup source under injected sandbox paths",async()=>{
  const {inspectQwen15LocalHost}=await import("../hercules-models/qwen15-owner-host.mjs");
  const dir=await mkdtemp(join(tmpdir(),"hercules-qwen15-cgroup-"));
  try{
    const model=join(dir,"fake.gguf"),exe=join(dir,"llama-server");
    await writeFile(model,"fake-model-bytes");
    await writeFile(exe,"#!/bin/sh\nexit 0\n",{mode:0o700});
    const files={
      "/sys/fs/cgroup/memory.max":"536870912",
      "/sys/fs/cgroup/memory.current":"128",
      "/sys/fs/cgroup/cpu.max":"10000 100000"
    };
    const x=await inspectQwen15LocalHost({
      modelPath:model,engineBinary:exe,
      systemProbe:()=>({arch:"arm64",cpuCount:4,totalMemBytes:12*GiB,freeMemBytes:8*GiB}),
      cgroupRead:async path=>{
        if(Object.hasOwn(files,path))return files[path];
        const e=new Error("no such file");e.code="ENOENT";throw e;
      }
    });
    assert.equal(x.cgroupMemoryLimitBytes,536870912);
    assert.equal(x.cgroupCpuCapacity,0.1);
    assert.equal(assessQwen15OwnerHost({...x,modelBytes:good.modelBytes,modelSha256:QWEN15_SHA256}).hardwareCompatibleForPrivateTrial,false);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test("failed cgroup read permission never silently promotes a host",async()=>{
  const {inspectQwen15LocalHost}=await import("../hercules-models/qwen15-owner-host.mjs");
  const dir=await mkdtemp(join(tmpdir(),"hercules-qwen15-unreadable-"));
  try{
    const model=join(dir,"fake.gguf"),exe=join(dir,"llama-server");
    await writeFile(model,"fake-model-bytes");
    await writeFile(exe,"#!/bin/sh\nexit 0\n",{mode:0o700});
    const x=await inspectQwen15LocalHost({
      modelPath:model,engineBinary:exe,
      systemProbe:()=>({arch:"arm64",cpuCount:4,totalMemBytes:12*GiB,freeMemBytes:8*GiB}),
      cgroupRead:async path=>{
        if(path.endsWith("memory.max")){const e=new Error("permission denied");e.code="EACCES";throw e;}
        const e=new Error("not found");e.code="ENOENT";throw e;
      }
    });
    assert.equal(x.cgroupInvalid,true);
    assert.equal(assessQwen15OwnerHost({...x,modelBytes:good.modelBytes,modelSha256:QWEN15_SHA256}).hardwareCompatibleForPrivateTrial,false);
  }finally{await rm(dir,{recursive:true,force:true})}
});
