import test from 'node:test';
import assert from 'node:assert/strict';
import {smallzRuntimeIdentity,assessSmallzReleaseEvidence,probeSmallzOwnerIdentity} from '../hercules-runtime/smallz-release-proof.mjs';
const oldCommit='a'.repeat(40),newCommit='b'.repeat(40);
const env={RENDER:'true',RENDER_SERVICE_ID:'srv-db08fglg1s2s73d0o2rg',RENDER_GIT_REPO_SLUG:'Sauceapproved7/expert-doodle',RENDER_GIT_BRANCH:'main',RENDER_GIT_COMMIT:oldCommit,IS_PULL_REQUEST:'false'};
const service={id:'srv-db08fglg1s2s73d0o2rg',name:'smallz-hercules',repo:'https://github.com/Sauceapproved7/expert-doodle',branch:'main',serviceDetails:{url:'https://smallz-hercules.onrender.com',runtime:'node'},suspended:'not_suspended'};
const deployment={status:'live',commit:{id:oldCommit}};
const runtime=smallzRuntimeIdentity(env);
test('accepts only complete canonical Render runtime identity without secrets',()=>{
  assert.equal(runtime.commitSha,oldCommit);
  assert.equal(runtime.renderServiceId,service.id);
  assert.equal(runtime.ownerAuthenticatedIdentityOnly,true);
  assert.equal(runtime.browserNavigationVerified,false);
  assert.equal(runtime.productionHealthVerified,false);
  assert.equal(runtime.releaseApproved,false);
  assert.equal(JSON.stringify(runtime).includes('token'),false);
});
test('rejects missing or impersonated Render metadata and preview builds',()=>{
  for(const bad of [{RENDER:'false'},{RENDER_GIT_COMMIT:'abc'},{RENDER_GIT_BRANCH:'feature'},{RENDER_GIT_REPO_SLUG:'other/repo'},{RENDER_SERVICE_ID:'srv-other'},{IS_PULL_REQUEST:'true'},{RENDER_GIT_COMMIT:'ABCDEF0123456789'.repeat(3)}])
    assert.equal(smallzRuntimeIdentity({...env,...bad}),null,JSON.stringify(bad));
});
test('provider current deployment record is distinct from GitHub main',()=>{
  const p=assessSmallzReleaseEvidence({service,deployment,githubMainSha:newCommit});
  assert.equal(p.providerRecordConsistent,true);
  assert.equal(p.providerDeployedCommit,oldCommit);
  assert.equal(p.githubHeadAlignment,'different_from_main');
  assert.equal(p.ownerRuntimeIdentityAligned,false);
  assert.equal(p.productionHealthVerified,false);
  assert.equal(p.releaseApproved,false);
});
test('provider binding rejects wrong service, repo, URL, deploy status or malformed commits',()=>{
  for(const patch of [{id:'srv-other'},{repo:'https://github.com/untrusted/code'},{branch:'preview'},{serviceDetails:{url:'https://evil.test',runtime:'node'}},{suspended:'suspended'}]){
    const p=assessSmallzReleaseEvidence({service:{...service,...patch},deployment,githubMainSha:oldCommit});
    assert.equal(p.providerRecordConsistent,false,JSON.stringify(patch));
  }
  for(const altered of [{status:'building'},{status:'live',commit:{id:'short'}}]){
    const p=assessSmallzReleaseEvidence({service,deployment:altered,githubMainSha:oldCommit});
    assert.equal(p.providerRecordConsistent,false);
  }
});
test('runtime and provider commit must agree before identity alignment',()=>{
  const reported={status:'observed',authenticatedControlReadObserved:true,identity:runtime};
  const good=assessSmallzReleaseEvidence({service,deployment,githubMainSha:oldCommit,ownerRead:reported});
  assert.equal(good.ownerRuntimeIdentityAligned,true);
  assert.equal(good.githubHeadAlignment,'matches_main');
  assert.equal(good.productionHealthVerified,false);
  assert.equal(good.releaseApproved,false);
  const bad=assessSmallzReleaseEvidence({service,deployment:{status:'live',commit:{id:newCommit}},githubMainSha:newCommit,ownerRead:reported});
  assert.equal(bad.ownerRuntimeIdentityAligned,false);
});
test('owner-only request is not attempted without Bearer token',async()=>{
  let called=false;
  const p=await probeSmallzOwnerIdentity({fetchImpl:async()=>{called=true;throw Error('should not happen')}});
  assert.equal(called,false);
  assert.equal(p.status,'not_attempted');
  assert.equal(p.identity,null);
  assert.equal(p.authenticatedControlReadObserved,false);
});
test('owner-only GET is fixed-destination with no redirect and never reports credentials',async()=>{
  const token='Bearer a_long_private_synthetic_owner_token';
  let observed;
  const p=await probeSmallzOwnerIdentity({ownerAuthorization:token,fetchImpl:async(url,options)=>{
    observed={url,options};
    return new Response(JSON.stringify(runtime),{status:200,headers:{'content-type':'application/json'}});
  }});
  assert.equal(observed.url,'https://smallz-hercules.onrender.com/api/runtime/identity');
  assert.equal(observed.options.method,'GET');
  assert.equal(observed.options.redirect,'manual');
  assert.equal(observed.options.credentials,'omit');
  assert.equal(p.status,'observed');
  assert.equal(p.identity.commitSha,oldCommit);
  assert.equal(p.authenticatedControlReadObserved,true);
  assert.equal(JSON.stringify(p).includes('a_long_private'),false);
});
test('unauthorized, redirected, malformed, oversized and network failures fail closed',async()=>{
  const token='Bearer a_long_private_synthetic_owner_token';
  for(const response of [
    new Response('no',{status:401}),
    new Response(null,{status:302,headers:{location:'https://evil.test/'}}),
    new Response('{}',{status:200,headers:{'content-type':'application/json'}}),
    new Response('{invalid}',{status:200,headers:{'content-type':'application/json'}}),
    new Response('X'.repeat(10000),{status:200,headers:{'content-type':'application/json'}}),
    new Response(JSON.stringify(runtime),{status:200,headers:{'content-type':'text/html'}}),
  ]){
    const p=await probeSmallzOwnerIdentity({ownerAuthorization:token,fetchImpl:async()=>response});
    assert.equal(p.authenticatedControlReadObserved,false);
    assert.equal(p.identity,null);
  }
  const fail=await probeSmallzOwnerIdentity({ownerAuthorization:token,fetchImpl:async()=>{throw new Error('secret=do-not-echo')}});
  assert.equal(JSON.stringify(fail).includes('do-not-echo'),false);
});
