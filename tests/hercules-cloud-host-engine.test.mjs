import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,lstat,mkdir,writeFile,chmod} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createSandboxHostPlan,createSandboxPermit} from "../hercules-deploy/cloud/host-agent.mjs";
import {runHostEngineOperation,assertHostEngineOperator} from "../hercules-deploy/cloud/host-engine.mjs";

const now=Date.parse("2026-10-13T17:00:00Z");
const image="registry.example/h-smoke@sha256:"+"a".repeat(64);
const request={serviceId:"hercules-smoke",releaseId:"release-1",sourceCommit:"f".repeat(40),
 artifactFingerprint:"b".repeat(64),publicOrigin:"https://example.com",
 target:{kind:"owned_linux",reference:"isolated-01"}};
const target={kind:"owned_linux",reference:"isolated-01",environment:"sandbox",
 verified:true,verifiedAt:new Date(now-10000).toISOString(),
 runtime:"rootless_docker",runtimeUid:1000,incrementalMonthlyCostUsd:0,
 allowlistedImages:[image]};
const plan=createSandboxHostPlan(request,{targets:[target],image,now});
const signingKey="owner-demo-only-"+"x".repeat(48);
const observation=()=>({
 osId:"ubuntu",osVersion:"24.04",architecture:"arm64",
 logicalCpus:2,memoryBytes:12*1024**3,availableDiskBytes:25*1024**3,
 userUid:1000,dockerSocket:"/run/user/1000/docker.sock",dockerSocketType:"socket",
 dockerSocketOwnerUid:1000,dockerSecurityOptions:["name=rootless"],observedAt:now-10000
});
async function withVault(fn){
 const parent=await mkdtemp(join(tmpdir(),"h-engine-"));
 const root=join(parent,"replay");
 try{return await fn(root);}finally{await rm(parent,{recursive:true,force:true})}
}
function fakeExec({rootless=true,running=true,failOn=null}={}){
 const calls=[];
 const impl=(file,args,opts,cb)=>{
  calls.push({file,args,opts});
  const verb=args[2]==="info"?"info":args[3];
  if(verb===failOn) return cb(Error("SECRET-SYSTEM-STACK"),"PRIVATE-TEXT");
  const stdout=verb==="info"?JSON.stringify(rootless?["name=rootless"]:["name=seccomp"]):verb==="inspect"?(running?"true\n":"false\n"):"";
  cb(null,stdout,"");
 };
 return {impl,calls};
}
function ctx(overrides={}){
 const f=fakeExec();
 const permit=createSandboxPermit(plan,{signingKey,action:"start",now,ttlMs:120000});
 return {plan,permit,signingKey,observation:observation(),now,processUid:1000,
  socketStat:{isSocket:()=>true,uid:1000,mode:0o140600},
  execFileImpl:f.impl,calls:f.calls,...overrides};
}
test("requires explicit local signed action and refuses anything else",async()=>withVault(async root=>{
 for(const change of [
  {enableSandbox:false},{action:"deploy"},{action:"start",permit:null},
  {action:"start",signingKey:"short"},
  {action:"start",permit:{...ctx().permit,signature:"0".repeat(64)}},
 ]){
  const q=ctx(change);
  await assert.rejects(()=>runHostEngineOperation({...q,root,action:q.action??"start"}),/sandbox_|permit_|signing_|engine_/);
  assert.equal(q.calls.length,0);
 }
}));
test("host operator identity and exact rootless socket proof enforced before subprocess",async()=>withVault(async root=>{
 for(const change of [
  {processUid:0},{processUid:1001},{socketStat:null},
  {socketStat:{isSocket:()=>false,uid:1000,mode:0o100600}},
  {socketStat:{isSocket:()=>true,uid:0,mode:0o140600}},
  {socketStat:{isSocket:()=>true,uid:1000,mode:0o140666}},
  {observation:{...observation(),architecture:"x86_64"}},
  {observation:{...observation(),observedAt:now-3600000}},
 ]){
  const q=ctx(change);
  await assert.rejects(()=>runHostEngineOperation({...q,root,action:"start",enableSandbox:true}),/host_|socket_|local_/);
  assert.equal(q.calls.length,0);
 }
}));
test("signed sandbox launch creates, starts and inspects exactly one container",()=>withVault(async root=>{
 const q=ctx();
 const receipt=await runHostEngineOperation({...q,root,action:"start",enableSandbox:true});
 assert.equal(receipt.sandboxRunningVerified,true);
 assert.equal(receipt.executionAuthorizedForProduction,false);
 assert.equal(receipt.independentHostingMachineVerified,false);
 assert.equal(receipt.providerCostVerified,false);
 assert.equal(receipt.planDigest,plan.planDigest);
 assert.deepEqual(q.calls.map(c=>c.args.slice(2,4)),[
  ["info","--format"],["container","create"],["container","start"],["container","inspect"]]);
 assert.ok(q.calls.every(c=>c.file==="/usr/bin/docker"&&c.opts.shell===false));
 assert.doesNotMatch(JSON.stringify(receipt),/owner-demo-only/);
}));
test("restarting process cannot replay previously consumed permit",()=>withVault(async root=>{
 const q=ctx();
 await runHostEngineOperation({...q,root,action:"start",enableSandbox:true});
 const before=q.calls.length;
 await assert.rejects(()=>runHostEngineOperation({...q,root,action:"start",enableSandbox:true}),/permit_replayed/);
 assert.equal(q.calls.length,before+1); // introspection only
}));
test("rootful daemon refuses launch even with a valid permit",()=>withVault(async root=>{
 const f=fakeExec({rootless:false});
 const q=ctx({execFileImpl:f.impl,calls:f.calls});
 await assert.rejects(()=>runHostEngineOperation({...q,root,action:"start",enableSandbox:true}),/rootless_docker_unverified/);
 assert.deepEqual(f.calls.map(c=>c.args[2]),["info"]);
}));
test("inspect failure triggers only bounded rollback of own name",()=>withVault(async root=>{
 const f=fakeExec({running:false});const q=ctx({execFileImpl:f.impl,calls:f.calls});
 await assert.rejects(()=>runHostEngineOperation({...q,root,action:"start",enableSandbox:true}),/sandbox_launch_unverified/);
 assert.equal(f.calls.at(-1).args.at(-1),plan.containerName);
 assert.deepEqual(f.calls.at(-1).args.slice(2,5),["container","rm","--force"]);
}));
test("rollback uses a separately signed one-use grant",()=>withVault(async root=>{
 const q=ctx({action:"rollback",permit:createSandboxPermit(plan,{signingKey,action:"rollback",now})});
 const result=await runHostEngineOperation({...q,root,enableSandbox:true});
 assert.equal(result.rolledBack,true);
 assert.equal(result.executionAuthorizedForProduction,false);
 assert.equal(q.calls.at(-1).args.at(-1),plan.containerName);
}));
test("no arbitrary command or inherited secrets can reach subprocess",()=>withVault(async root=>{
 const q=ctx();
 const result=await runHostEngineOperation({...q,root,action:"start",enableSandbox:true,
  requestCommand:"docker run --privileged",ownerToken:"SECRET-OWNER"});
 assert.equal(result.sandboxRunningVerified,true);
 assert.ok(q.calls.every(c=>c.opts.env.DOCKER_HOST===undefined));
 assert.ok(q.calls.every(c=>c.opts.env.PATH==="/usr/bin:/bin"));
 assert.doesNotMatch(JSON.stringify(result),/SECRET-OWNER/);
}));
test("host verification never trusts self-asserted OCI billing or ownership",()=>{
 const result=assertHostEngineOperator(plan,{observation:{...observation(),providerCostVerified:true,serverOwnedByUser:true},
  processUid:1000,socketStat:{isSocket:()=>true,uid:1000,mode:0o140600},now});
 assert.equal(result.localOperatorVerified,true);
 assert.equal(result.providerCostVerified,false);
 assert.equal(result.independentHostingMachineVerified,false);
 assert.equal(result.productionApproved,false);
});
test("no machine, no subprocess adapter, or inaccessible replay directory is never an execution grant",()=>withVault(async root=>{
 for(const change of [
  {execFileImpl:null},{root:"/path/that/is/not/writable/"+Date.now()},
  {observation:null},{socketStat:null}
 ]){
  const q=ctx(change);
  await assert.rejects(()=>runHostEngineOperation({...q,root:change.root??root,action:"start",enableSandbox:true}));
 }
}));

test("standalone operator defaults off and does not leak inherited owner secrets",()=>{
 const bin=new URL("../hercules-deploy/cloud/host-engine-cli.mjs",import.meta.url);
 for(const enabled of ["false","true"]){
  const r=spawnSync(process.execPath,[bin.pathname,"start"],{
   encoding:"utf8",timeout:7000,
   env:{...process.env,HERCULES_HOST_ENGINE_SANDBOX_ENABLED:enabled,
    HERCULES_HOST_ENGINE_OWNER_KEY_FILE:"OWNER-SECRET-KEY-LOCAL"}
  });
  assert.equal(r.status,1);
  assert.doesNotMatch(r.stdout+r.stderr,/OWNER-SECRET-KEY-LOCAL/);
  assert.match(r.stderr,/host_engine_disabled|host_engine_unverified_or_action_denied/);
 }
});
test("Host Engine CLI has no public listener and only the declared Docker subprocess",()=>{
 const cli=readFileSync(new URL("../hercules-deploy/cloud/host-engine-cli.mjs",import.meta.url),"utf8");
 assert.ok(cli.includes("HERCULES_HOST_ENGINE_SANDBOX_ENABLED"));
 assert.ok(cli.includes("HERCULES_HOST_ENGINE_OWNER_KEY_FILE"));
 for(const forbidden of ["createServer(","listen(","fetch(","eval(","http.request("])
  assert.equal(cli.includes(forbidden),false,forbidden);
});
