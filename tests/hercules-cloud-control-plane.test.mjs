import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightCloudDeployment} from '../hercules-deploy/cloud/preflight.mjs';
import {createHerculesCloudServer} from '../hercules-deploy/cloud/server.mjs';

const release = Object.freeze({
 serviceId:'cloud-preview',releaseId:'preview-r1',
 sourceCommit:'a'.repeat(40),artifactFingerprint:'b'.repeat(64),
 publicOrigin:'https://preview.example.com',
 target:{kind:'owned_linux',reference:'sandbox-01'},
 metadata:{scope:'isolated-cloud-demo'}
});
const sandbox = Object.freeze({
 kind:'owned_linux',reference:'sandbox-01',environment:'sandbox',
 verified:true,incrementalMonthlyCostUsd:0
});

test('unregistered targets are held; no implicit production authority',()=>{
 const result=preflightCloudDeployment(release);
 assert.equal(result.readyForStaging,false);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.productionAuthorized,false);
 assert.ok(result.blockedReasons.includes('target_not_registered'));
});
test('verified zero-increment isolated target can be staged but never automatically deployed',()=>{
 const result=preflightCloudDeployment(release,{targets:[sandbox]});
 assert.equal(result.readyForStaging,true);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.productionAuthorized,false);
 assert.equal(result.costChangeUsd,0);
 assert.equal(result.mode,'isolated-preflight');
 assert.equal(result.schema,'hercules.cloud.preflight.v1');
});
test('positive or unverified cost blocks staging',()=>{
 for(const incrementalMonthlyCostUsd of [1,5,null,'0','free']){
  const result=preflightCloudDeployment(release,{targets:[{...sandbox,incrementalMonthlyCostUsd}]});
  assert.equal(result.readyForStaging,false);
  assert.ok(result.blockedReasons.includes('unverified_zero_cost'));
 }
});
test('production or unverified host blocked even when declared free',()=>{
 for(const target of [{...sandbox,environment:'production'},{...sandbox,verified:false}]){
  const result=preflightCloudDeployment(release,{targets:[target]});
  assert.equal(result.readyForStaging,false);
  assert.equal(result.executionAuthorized,false);
 }
});
test('rejects secret-shaped metadata, invalid SHA and injected URLs',()=>{
 assert.throws(()=>preflightCloudDeployment({...release,metadata:{apiToken:'test'}}),/secret-shaped/i);
 assert.throws(()=>preflightCloudDeployment({...release,sourceCommit:'unverified'}),/sourceCommit/i);
 assert.throws(()=>preflightCloudDeployment({...release,publicOrigin:'http://127.0.0.1:8080'}),/https/i);
 assert.throws(()=>preflightCloudDeployment({...release,target:{kind:'owned_linux',reference:'https://user:pass@host.example'}}),/credentials/i);
});
test('target allowlist exact match only, not user-provided attestation',()=>{
 const result=preflightCloudDeployment({...release,target:{kind:'owned_linux',reference:'sandbox-01-other'}},{targets:[sandbox]});
 assert.equal(result.readyForStaging,false);
});
test('cloud API fails closed without configured operator identity',async()=>{
 const server=createHerculesCloudServer({ownerToken:'',targets:[sandbox]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const health=await fetch(base+'/health');
  assert.equal(health.status,200);
  const h=await health.json();
  assert.equal(h.productionAuthorized,false);
  assert.equal(h.mode,'isolated-preflight');
  const pre=await fetch(base+'/api/preflight',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(release)});
  assert.equal(pre.status,503);
  const no=await fetch(base+'/api/capabilities');
  assert.equal(no.status,503);
 }finally{await new Promise(r=>server.close(r))}
});
test('cloud API requires bearer; never executes deployments',async()=>{
 const server=createHerculesCloudServer({ownerToken:'x'.repeat(40),targets:[sandbox]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const denied=await fetch(base+'/api/preflight',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer wrong'},body:JSON.stringify(release)});
  assert.equal(denied.status,401);
  const opts={method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+'x'.repeat(40)},body:JSON.stringify(release)};
  const allowed=await fetch(base+'/api/preflight',opts);
  assert.equal(allowed.status,200);
  const result=await allowed.json();
  assert.equal(result.readyForStaging,true);
  assert.equal(result.executionAuthorized,false);
  assert.equal((await fetch(base+'/api/deploy',opts)).status,404);
 }finally{await new Promise(r=>server.close(r))}
});
