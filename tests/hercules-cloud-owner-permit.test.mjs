import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createSandboxHostPlan,createSandboxPermit,executeSandboxHostPlan} from "../hercules-deploy/cloud/host-agent.mjs";
import {createOwnerSignedPermit} from "../hercules-deploy/cloud/owner-permit.mjs";
import {runHostEngineOperation} from "../hercules-deploy/cloud/host-engine.mjs";

const now=Date.parse("2026-10-13T18:00:00Z");
const pair=generateKeyPairSync("ed25519");
const privateKey=pair.privateKey.export({type:"pkcs8",format:"pem"});
const publicKey=pair.publicKey.export({type:"spki",format:"pem"});
const other=generateKeyPairSync("ed25519").publicKey.export({type:"spki",format:"pem"});
const image="registry.example/h-smoke@sha256:"+"a".repeat(64);
const req={serviceId:"hercules-smoke",releaseId:"release-1",sourceCommit:"f".repeat(40),
 artifactFingerprint:"b".repeat(64),publicOrigin:"https://example.com",target:{kind:"owned_linux",reference:"isolated-01"}};
const target={kind:"owned_linux",reference:"isolated-01",environment:"sandbox",verified:true,
 verifiedAt:new Date(now-10000).toISOString(),runtime:"rootless_docker",runtimeUid:1000,
 incrementalMonthlyCostUsd:0,allowlistedImages:[image]};
const plan=createSandboxHostPlan(req,{targets:[target],image,now});
const sign=(action="start")=>createOwnerSignedPermit(plan,{ownerPrivateKey:privateKey,action,now,ttlMs:60000});
function fakeExec(){
 const calls=[];
 const impl=(file,args,opts,cb)=>{
  calls.push({file,args,opts});
  const verb=args[2]==="info"?"info":args[3];
  cb(null,verb==="info"?'["name=rootless"]':verb==="inspect"?"true\n":"","");
 };
 return {calls,impl};
}
const observation={osId:"ubuntu",osVersion:"24.04",architecture:"aarch64",
 logicalCpus:2,memoryBytes:12*1024**3,availableDiskBytes:25*1024**3,userUid:1000,
 dockerSocket:"/run/user/1000/docker.sock",dockerSocketType:"socket",
 dockerSocketOwnerUid:1000,dockerSecurityOptions:["name=rootless"],observedAt:now-10000};
const socketStat={isSocket:()=>true,uid:1000,mode:0o140600};
async function runWithVault(fn){
 const base=await mkdtemp(join(tmpdir(),"h-owner-ed-"));
 try{return await fn(join(base,"replay"));}finally{await rm(base,{recursive:true,force:true});}
}
const input=(root,action="start")=>{
 const f=fakeExec();
 return {root,action,plan,permit:sign(action),ownerPublicKey:publicKey,
  observation,processUid:1000,socketStat,execFileImpl:f.impl,
  enableSandbox:true,now,calls:f.calls};
};
test("owner-only Ed25519 signer creates short-lived digest/action-bound public-verifiable permits",()=>{
 const p=sign();
 assert.equal(p.schema,"hercules.cloud.sandbox-permit.ed25519.v1");
 assert.match(p.signature,/^[A-Za-z0-9_-]{86}$/);
 assert.equal(p.planDigest,plan.planDigest);
 assert.ok(!JSON.stringify(p).includes(privateKey));
 assert.throws(()=>createOwnerSignedPermit(plan,{ownerPrivateKey:publicKey,now}),/owner_private_key_invalid/);
 assert.throws(()=>createOwnerSignedPermit(plan,{ownerPrivateKey:privateKey,ttlMs:3600000,now}),/permit_ttl_invalid/);
});
test("verified Ed25519 permit executes actual host-engine adapter, never grants production",()=>runWithVault(async root=>{
 const q=input(root);const r=await runHostEngineOperation(q);
 assert.equal(r.sandboxRunningVerified,true);
 assert.equal(r.executionAuthorizedForProduction,false);
 assert.equal(r.independentHostingMachineVerified,false);
 assert.deepEqual(q.calls.map(x=>x.args.slice(2,4)),[
  ["info","--format"],["container","create"],["container","start"],["container","inspect"]]);
 assert.ok(q.calls.every(x=>x.opts.env.PATH==="/usr/bin:/bin"));
}));
test("HMAC permits and signing secrets cannot authorize the new real host operator",()=>runWithVault(async root=>{
 const f=fakeExec(); const hmac=createSandboxPermit(plan,{signingKey:"z".repeat(48),now,action:"start"});
 await assert.rejects(()=>runHostEngineOperation({
  ...input(root),permit:hmac,signingKey:"z".repeat(48),execFileImpl:f.impl
 }),/owner_public_key_required|permit_schema_invalid/);
 assert.equal(f.calls.length,0);
}));
test("wrong owner key, signature and action cause zero Docker commands",()=>runWithVault(async root=>{
 for(const modify of [
  {ownerPublicKey:other},
  {permit:{...sign(),signature:"A".repeat(86)}},
  {permit:{...sign(),action:"rollback"}},
  {permit:{...sign(),planDigest:"0".repeat(64)}},
  {ownerPublicKey:"not-a-key"},
  {ownerPublicKey:privateKey},
  {permit:{...sign(),expiresAt:now-1}},
 ]){
  const q=input(root);
  await assert.rejects(()=>runHostEngineOperation({...q,...modify}),
   /permit_|owner_|signature_|public_key_/);
  assert.equal(q.calls.length,0);
 }
}));
test("owner-signed start one-use across restarts; rollback requires separate signed permit",()=>runWithVault(async root=>{
 const q=input(root);
 await runHostEngineOperation(q);
 const count=q.calls.length;
 await assert.rejects(()=>runHostEngineOperation(q),/permit_replayed/);
 assert.equal(q.calls.length,count+1); // bounded rootless introspection only
 const rollback=input(root,"rollback");
 const res=await runHostEngineOperation(rollback);
 assert.equal(res.rolledBack,true);
 assert.equal(rollback.calls.at(-1).args.at(-1),plan.containerName);
}));
test("existing isolated HMAC library remains backward-compatible only in the old test interface",async()=>{
 let calls=0;
 const runCommand=async()=>{calls++;return {exitCode:0,stdout:calls===1?'["name=rootless"]':calls===4?"true\n":""}};
 const hmac=createSandboxPermit(plan,{signingKey:"z".repeat(48),now,action:"start"});
 const receipt=await executeSandboxHostPlan(plan,{permit:hmac,signingKey:"z".repeat(48),
  runCommand,consumeNonce:async()=>true,now});
 assert.equal(receipt.runningVerified,true);
});
test("host CLI reads only public verification key, never a signing private key",async()=>{
 const {readFileSync}=await import("node:fs");
 const s=readFileSync(new URL("../hercules-deploy/cloud/host-engine-cli.mjs",import.meta.url),"utf8");
 assert.ok(s.includes("loadOwnerTrustAnchor("));
 assert.equal(s.includes("HERCULES_HOST_ENGINE_OWNER_PUBLIC_KEY_FILE"),false);
 assert.equal(s.includes("HERCULES_HOST_ENGINE_OWNER_KEY_FILE"),false);
 assert.ok(!s.includes("createPrivateKey("));
});
