import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createSandboxHostPlan,createSandboxPermit,
 executeSandboxHostPlan,rollbackSandboxHostPlan
} from '../hercules-deploy/cloud/host-agent.mjs';

const time=Date.parse('2026-10-13T14:10:00.000Z');
const image='registry.example/hercules-smoke@sha256:'+'c'.repeat(64);
const request={
 serviceId:'hercules-smoke',releaseId:'smoke-r1',
 sourceCommit:'a'.repeat(40),artifactFingerprint:'b'.repeat(64),
 publicOrigin:'https://test.example.com',
 target:{kind:'owned_linux',reference:'sandbox-01'},
 metadata:{scope:'hercules-cloud-isolated-testing'}
};
const sandbox={
 kind:'owned_linux',reference:'sandbox-01',environment:'sandbox',
 verified:true,verifiedAt:'2026-10-13T14:09:00.000Z',
 runtime:'rootless_docker',runtimeUid:1000,incrementalMonthlyCostUsd:0,
 allowlistedImages:[image]
};
const key='k'.repeat(48);
const options={targets:[sandbox],image,now:time};
const create=()=>createSandboxHostPlan(request,options);
const signer=(plan,action='start')=>createSandboxPermit(plan,{signingKey:key,action,now:time,ttlMs:120000});
function fakeRunner(){
 const calls=[];
 const runCommand=async(file,args)=>{
   calls.push({file,args});
   assert.equal(file,'docker');
   assert.deepEqual(args.slice(0,2),['--host','unix:///run/user/1000/docker.sock']);
   if(args[2]==='info')return {exitCode:0,stdout:'[\"name=rootless\"]',stderr:''};
   if(args[0]==='container'&&args[1]==='inspect')
     return {exitCode:0,stdout:'true\n',stderr:''};
   return {exitCode:0,stdout:'',stderr:''};
 };
 return {calls,runCommand};
}
function nonceStore(){
 const nonces=new Set();
 return async nonce=>{if(nonces.has(nonce))return false;nonces.add(nonce);return true};
}

test('requires pre-existing owner-attested zero-cost rootless isolated host',()=>{
 for(const targets of [
   [],[{...sandbox,environment:'production'}],
   [{...sandbox,verified:false}],
   [{...sandbox,incrementalMonthlyCostUsd:1}],
   [{...sandbox,incrementalMonthlyCostUsd:null}],
   [{...sandbox,incrementalMonthlyCostUsd:'0'}],
   [{...sandbox,runtime:'docker'}],
   [{...sandbox,runtimeUid:0}],
   [{...sandbox,runtimeUid:999999}],
   [{...sandbox,verifiedAt:'2026-10-13T13:00:00Z'}],
   [{...sandbox,reference:'sandbox-02'}],
   [{...sandbox,verifiedAt:'2026-10-13T15:00:00Z'}],
 ]){
   assert.throws(()=>createSandboxHostPlan(request,{...options,targets}),/sandbox_host_not_authorized/);
 }
});
test('no command or external image can be supplied by caller',()=>{
 assert.throws(()=>createSandboxHostPlan(request,{...options,image:'ubuntu:latest'}),/pinned_allowlisted_image_required/);
 assert.throws(()=>createSandboxHostPlan(request,{...options,image:'registry.example/image@sha256:'+'d'.repeat(64)}),/pinned_allowlisted_image_required/);
 assert.throws(()=>createSandboxHostPlan({...request,sourceCommit:'invalid'},options),/sourceCommit/);
 assert.throws(()=>createSandboxHostPlan({...request,metadata:{apiToken:'secret'}},options),/secret-shaped/);
});
test('immutable docker plan is rootless sandbox, no network, no volumes, no port binding and no image pull',()=>{
 const plan=create();
 assert.equal(plan.schema,'hercules.cloud.host-plan.v1');
 assert.equal(plan.mode,'sandbox-no-network');
 assert.equal(plan.executionAuthorized,false);
 assert.equal(plan.productionAuthorized,false);
 assert.equal(plan.costChangeUsd,0);
 assert.equal(plan.rootlessSocket,'unix:///run/user/1000/docker.sock');
 assert.match(plan.containerName,/^hc-[a-f0-9]{24}$/);
 const args=plan.commands.create;
 assert.deepEqual(args.slice(0,2),['container','create']);
 for(const part of ['--pull','never','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','128m','--cpus','0.5','--user','65532:65532','--restart','no']){
  assert.ok(args.includes(part),part+' not found');
 }
 assert.equal(args.at(-1),image);
 const joined=args.join(' ');
 for(const word of ['--privileged','--publish','--volume','--mount','host','--device','--pid=host','--network host']){
  assert.ok(!joined.includes(word),word+' unexpectedly allowed');
 }
 assert.equal(plan.commands.start[0],'container');
 assert.equal(plan.commands.inspect.at(-1),plan.containerName);
 assert.equal(plan.commands.rollback.at(-1),plan.containerName);
});
test('permit binds exact immutable command plan, action and short expiry',()=>{
 const plan=create();
 const permit=signer(plan);
 assert.equal(permit.action,'start');
 assert.equal(typeof permit.signature,'string');
 assert.equal(permit.signature.length,64);
 assert.throws(()=>createSandboxPermit(plan,{signingKey:key,now:time,ttlMs:3600000}),/permit_ttl_invalid/);
 assert.throws(()=>createSandboxPermit(plan,{signingKey:'short',now:time}),/signing_key_required/);
});
test('no Docker action without injected isolated runner and replay-protected nonce store',async()=>{
 const plan=create(),permit=signer(plan);
 const {runCommand}=fakeRunner();
 await assert.rejects(()=>executeSandboxHostPlan(plan,{permit,signingKey:key,consumeNonce:nonceStore(),now:time}),/runner_unavailable/);
 await assert.rejects(()=>executeSandboxHostPlan(plan,{permit,signingKey:key,runCommand,now:time}),/replay_store_required/);
});
test('tampered plan, signature, wrong action, expiry or wrong key cannot reach Docker',async()=>{
 const plan=create(),permit=signer(plan);
 const {calls,runCommand}=fakeRunner();
 const consumeNonce=nonceStore();
 const common={signingKey:key,runCommand,consumeNonce,now:time};
 for(const [pl,p,over] of [
  [{...plan,commands:{...plan.commands,create:['container','run','--privileged']}},permit,{}],
  [plan,{...permit,signature:'0'.repeat(64)},{}],
  [plan,signer(plan,'rollback'),{}],
  [plan,permit,{signingKey:'z'.repeat(48)}],
  [plan,permit,{now:time+120001}],
  [plan,permit,{now:time-60000}]
 ]){
  await assert.rejects(()=>executeSandboxHostPlan(pl,{...common,...over}),/permit_|plan_|expired|unauthorized/);
 }
 assert.equal(calls.length,0);
});
test('valid owner grant only starts an already-local immutable image and verifies running state',async()=>{
 const plan=create(),permit=signer(plan);const {calls,runCommand}=fakeRunner();
 const proof=await executeSandboxHostPlan(plan,{permit,signingKey:key,now:time,runCommand,consumeNonce:nonceStore()});
 assert.equal(proof.started,true);
 assert.equal(proof.runningVerified,true);
 assert.equal(proof.productionAuthorized,false);
 assert.equal(proof.containerName,plan.containerName);
 assert.deepEqual(calls.map(x=>x.args.slice(2,4)),[['info','--format'],['container','create'],['container','start'],['container','inspect']]);
 assert.equal(JSON.stringify(proof).includes(key),false);
});
test('same signed permit cannot be executed twice through a durable replay store interface',async()=>{
 const plan=create(),permit=signer(plan),consumeNonce=nonceStore(),runner=fakeRunner();
 const params={permit,signingKey:key,now:time,runCommand:runner.runCommand,consumeNonce};
 await executeSandboxHostPlan(plan,params);
 await assert.rejects(()=>executeSandboxHostPlan(plan,params),/permit_replayed/);
 assert.equal(runner.calls.length,5);
 assert.equal(runner.calls.at(-1).args[2],'info');
});
test('failed verification attempts bounded cleanup and does not claim success',async()=>{
 const plan=create(),permit=signer(plan),calls=[];
 const runner=async(file,args)=>{
  calls.push(args);
  if(args[2]==='info')return {exitCode:0,stdout:'["name=rootless"]',stderr:''};
  if(args[1]==='inspect')return {exitCode:0,stdout:'false\n',stderr:''};
  return {exitCode:0,stdout:'',stderr:''};
 };
 await assert.rejects(()=>executeSandboxHostPlan(plan,{permit,signingKey:key,now:time,runCommand:runner,consumeNonce:nonceStore()}),/sandbox_launch_unverified/);
 assert.deepEqual(calls.at(-1).slice(2),plan.commands.rollback);
});
test('rollback requires separate signed action bound to same container and cannot remove foreign names',async()=>{
 const plan=create(),permit=signer(plan,'rollback'),runner=fakeRunner();
 const proof=await rollbackSandboxHostPlan(plan,{permit,signingKey:key,now:time,runCommand:runner.runCommand,consumeNonce:nonceStore()});
 assert.equal(proof.rolledBack,true);
 assert.equal(proof.productionAuthorized,false);
 assert.deepEqual(runner.calls[1].args.slice(2),plan.commands.rollback);
 await assert.rejects(()=>rollbackSandboxHostPlan(plan,{permit:signer(plan),signingKey:key,now:time,runCommand:runner.runCommand,consumeNonce:nonceStore()}),/permit_action_mismatch/);
});

test('rootful Docker daemon is refused before any container action or replay consumption',async()=>{
 const plan=create(),permit=signer(plan),calls=[];
 let used=false;
 const runCommand=async(file,args)=>{
  calls.push(args);
  return {exitCode:0,stdout:args[2]==='info'?'["name=seccomp"]':'true'};
 };
 await assert.rejects(()=>executeSandboxHostPlan(plan,{
  permit,signingKey:key,now:time,runCommand,
  consumeNonce:async()=>{used=true;return true}
 }),/rootless_docker_unverified/);
 assert.equal(used,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0][2],'info');
});
