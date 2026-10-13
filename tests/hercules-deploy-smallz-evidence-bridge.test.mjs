import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSmallzEvidence} from '../hercules-deploy/smallz-evidence-bridge.mjs';
const LIVE='ac4ebb822e421e4cc3a3b6bbea28330552304d95',HEAD='76b00962f32fdbe3dfb375e38a33290c8156a512';
const service={id:'srv-db08fglg1s2s73d0o2rg',name:'smallz-hercules',repo:'https://github.com/Sauceapproved7/expert-doodle',branch:'main',suspended:'not_suspended',autoDeploy:'yes',autoDeployTrigger:'commit',serviceDetails:{url:'https://smallz-hercules.onrender.com',runtime:'node',plan:'free'}};
const deployment={id:'dep-db6psunf3r2c73c27ph0',status:'live',commit:{id:LIVE},trigger:'manual'};
const github=sha=>({result:{content:JSON.stringify({ref:'refs/heads/main',object:{sha}})}});
const render=obj=>({text:JSON.stringify(obj)+'\n\n cursor: unused-provider-pagination-token'});
const identity={status:'observed',authenticatedControlReadObserved:true,identity:{schema:'sauceapproved.hercules.smallz-runtime-identity.v1',service:'smallz',renderServiceId:service.id,repository:'Sauceapproved7/expert-doodle',branch:'main',commitSha:LIVE,ownerAuthenticatedIdentityOnly:true,externalControlReadObserved:true}};
const fixture=({head=HEAD,serviceValue=service,deploy=deployment,owner}={})=>({
  githubRead:async()=>github(head),renderServiceRead:async()=>render(serviceValue),
  renderDeployRead:async()=>render([deploy]),...(owner?{ownerIdentityRead:async()=>owner}:{})
});
test('uses only pinned read-only GitHub and Render identifiers and reports real-world main/live drift',async()=>{
  const args=[];
  const deps=fixture();
  const proof=await collectSmallzEvidence({
    githubRead:async a=>{args.push(['github',a]);return deps.githubRead()},
    renderServiceRead:async a=>{args.push(['service',a]);return deps.renderServiceRead()},
    renderDeployRead:async a=>{args.push(['deploy',a]);return deps.renderDeployRead()}
  });
  assert.equal(proof.status,'HOLD');
  assert.equal(proof.mainCommit,HEAD);
  assert.equal(proof.liveCommit,LIVE);
  assert.equal(proof.liveDeploymentId,deployment.id);
  assert.ok(proof.reasonCodes.includes('MAIN_DEPLOY_SHA_MISMATCH'));
  assert.ok(proof.reasonCodes.includes('AUTO_DEPLOY_ACTIVE'));
  assert.ok(proof.reasonCodes.includes('OWNER_RUNTIME_UNVERIFIED'));
  assert.deepEqual(args,[
    ['github',{url:'https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main'}],
    ['service',{workspaceId:'tea-dalo7he5vjqs7383n2o0',serviceId:service.id}],
    ['deploy',{workspaceId:'tea-dalo7he5vjqs7383n2o0',serviceId:service.id,limit:1}]
  ]);
  assert.equal(proof.executionAuthority,false);
  assert.equal(proof.productionChanged,false);
  assert.equal(proof.providerRecordsIndependentlyAuthenticated,false);
  assert.equal(proof.ownerAuthorizationVerified,false);
  assert.equal(proof.runtimeHealthVerified,false);
  assert.equal(proof.releaseApproved,false);
});
test('even agreement among caller-supplied readers is NOT independent provider authentication',async()=>{
  const off={...service,autoDeploy:'no',autoDeployTrigger:'off'};
  const proof=await collectSmallzEvidence(fixture({head:LIVE,serviceValue:off,owner:identity}));
  assert.equal(proof.status,'CONSISTENT_UNATTESTED');
  assert.deepEqual(proof.reasonCodes,[]);
  assert.equal(proof.ownerRuntimeRecordAligned,true);
  assert.equal(proof.providerRecordsIndependentlyAuthenticated,false);
  assert.equal(proof.executionAuthority,false);
  assert.equal(proof.releaseApproved,false);
});
test('missing or malformed readers fail closed without network calls',async()=>{
  const p=await collectSmallzEvidence({});
  assert.equal(p.status,'HOLD');
  assert.deepEqual(p.reasonCodes,['MISSING_READERS']);
  assert.equal(p.mainCommit,null);
  for(const mutation of [{githubRead:async()=>github('bad')},{renderServiceRead:async()=>render({id:'other'})},{renderDeployRead:async()=>render([])}]){
    const x=await collectSmallzEvidence({...fixture(),...mutation});
    assert.equal(x.status,'HOLD');
    assert.equal(x.executionAuthority,false);
  }
});
test('provider errors and malformed envelopes are suppressed, not logged or treated as evidence',async()=>{
  const secret='Bearer never-output-credential';
  for(const mutation of [
    {renderServiceRead:async()=>{throw Error(secret)}},
    {renderDeployRead:async()=>({text:secret})},
    {githubRead:async()=>({result:{content:'x'.repeat(100000)}})},
    {renderServiceRead:async()=>({text:'{"id":'})}
  ]){
    const proof=await collectSmallzEvidence({...fixture(),...mutation});
    assert.equal(proof.status,'HOLD');
    assert.ok(proof.reasonCodes.includes('PROVIDER_READ_FAILED'));
    assert.equal(JSON.stringify(proof).includes(secret),false);
  }
});
test('rejects stale, conflicting and forged runtime evidence as unverified',async()=>{
  const altered={...identity,identity:{...identity.identity,commitSha:HEAD}};
  for(const owner of [altered,{...identity,authenticatedControlReadObserved:false},{status:'observed',identity:{...identity.identity,releaseApproved:true}}]){
    const proof=await collectSmallzEvidence(fixture({head:LIVE,serviceValue:{...service,autoDeploy:'no',autoDeployTrigger:'off'},owner}));
    assert.equal(proof.status,'HOLD');
    assert.ok(proof.reasonCodes.includes('OWNER_RUNTIME_UNVERIFIED'));
  }
});
test('cannot be repurposed to deploy, approve, use secrets or call unapproved URLs',async()=>{
  const proof=await collectSmallzEvidence({...fixture(),authorization:'Bearer secret-injection',releaseCommit:HEAD,method:'POST',url:'https://other.example/evil',requestBody:{apiKey:'x'}});
  assert.equal(JSON.stringify(proof).includes('secret-injection'),false);
  assert.equal(JSON.stringify(proof).includes('apiKey'),false);
  assert.equal(proof.productionChanged,false);
  assert.equal(proof.networkOperationsPerformedByModule,false);
  assert.equal(proof.executionAuthority,false);
});
