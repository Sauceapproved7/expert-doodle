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
  assert.match(code,/===\s*"true"/);
  assert.match(code,/createLocalChatAdapter/);
  assert.match(code,/listenModelPlaneService/);
  assert.match(code,/127\.0\.0\.1/);
  assert.doesNotMatch(code,/listen\s*\(\s*[^,]+,\s*["']0\.0\.0\.0["']/);
  assert.doesNotMatch(code,/oci\s+compute\s+instance\s+launch|RENDER_API_KEY|OPENAI_API_KEY/);
});
