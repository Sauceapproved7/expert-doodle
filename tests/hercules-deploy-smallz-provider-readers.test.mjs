import test from 'node:test';
import assert from 'node:assert/strict';
import {createSmallzProviderReaders} from '../hercules-deploy/smallz-provider-readers.mjs';
import {collectSmallzEvidence} from '../hercules-deploy/smallz-evidence-bridge.mjs';

const SERVICE='srv-db08fglg1s2s73d0o2rg',WORKSPACE='tea-dalo7he5vjqs7383n2o0';
const SHA='a'.repeat(40);
const GITHUB='https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main';
const RENDER='https://api.render.com/v1/services/'+SERVICE;
const DEPLOYS=RENDER+'/deploys?limit=1';
const service={id:SERVICE,name:'smallz-hercules',repo:'https://github.com/Sauceapproved7/expert-doodle',branch:'main',
  suspended:'not_suspended',autoDeploy:'no',autoDeployTrigger:'off',
  serviceDetails:{url:'https://smallz-hercules.onrender.com',runtime:'node',plan:'free'}};
const deployment={id:'dep-'+('a'.repeat(18)),status:'live',commit:{id:SHA},trigger:'manual'};
const tokens={renderApiToken:'r'.repeat(32),githubApiToken:'g'.repeat(32)};
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json; charset=utf-8'}});
const responseFor=(url)=>{
  if(url===GITHUB)return json({ref:'refs/heads/main',object:{sha:SHA},extra:'untrusted'});
  if(url===RENDER)return json({...service,ownerPrivateToken:'must-not-return'});
  if(url===DEPLOYS)return json([{deploy:{...deployment,image:{registryCredential:'secret-shaped'}} ,cursor:'private-cursor'}]);
  throw Error('unexpected URL');
};
const factory=(fetchImpl)=>createSmallzProviderReaders({...tokens,fetchImpl});

test('reads exact GitHub/Render REST URLs with GET, no redirects, without exposing tokens',async()=>{
  const calls=[];
  const readers=factory(async(url,init)=>{
    calls.push({url,method:init.method,redirect:init.redirect,cache:init.cache,accept:init.headers.accept,auth:init.headers.authorization});
    return responseFor(url);
  });
  const evidence=await collectSmallzEvidence(readers);
  assert.deepEqual(calls.map(c=>c.url).sort(),[GITHUB,RENDER,DEPLOYS].sort());
  for(const call of calls){
    assert.equal(call.method,'GET');
    assert.equal(call.redirect,'error');
    assert.equal(call.cache,'no-store');
    assert.equal(call.accept,'application/json');
    assert.match(call.auth,/^Bearer /);
  }
  assert.equal(evidence.mainCommit,SHA);
  assert.equal(evidence.liveCommit,SHA);
  assert.equal(evidence.liveDeploymentId,deployment.id);
  assert.equal(evidence.status,'HOLD');
  assert.deepEqual(evidence.reasonCodes,['OWNER_RUNTIME_UNVERIFIED']);
  assert.equal(evidence.providerRecordsIndependentlyAuthenticated,false);
  assert.equal(evidence.releaseApproved,false);
  assert.equal(JSON.stringify(evidence).includes('must-not-return'),false);
  assert.equal(JSON.stringify(evidence).includes('private-cursor'),false);
  assert.equal(JSON.stringify(readers).includes(tokens.renderApiToken),false);
  assert.equal(JSON.stringify(readers).includes(tokens.githubApiToken),false);
});
test('readers do not support attacker-controlled URLs or service identifiers',async()=>{
  let called=0;
  const readers=factory(async()=>{called++;return json({})});
  await assert.rejects(readers.githubRead({url:'https://evil.example/steal'}),/unapproved/);
  await assert.rejects(readers.renderServiceRead({workspaceId:'not-allowed',serviceId:SERVICE}),/unapproved/);
  await assert.rejects(readers.renderDeployRead({workspaceId:WORKSPACE,serviceId:'srv-attacker',limit:1}),/unapproved/);
  await assert.rejects(readers.renderDeployRead({workspaceId:WORKSPACE,serviceId:SERVICE,limit:50}),/unapproved/);
  assert.equal(called,0);
});
test('requires separate Render and GitHub private credentials without printing them',()=>{
  for(const v of [undefined,'','short','token has space']){
    assert.throws(()=>createSmallzProviderReaders({...tokens,renderApiToken:v,fetchImpl:async()=>{}}),/credential/);
    assert.throws(()=>createSmallzProviderReaders({...tokens,githubApiToken:v,fetchImpl:async()=>{}}),/credential/);
  }
});
test('malformed, non-JSON, redirected or oversized network replies fail closed',async()=>{
  const cases=[
    new Response('not-json',{status:200,headers:{'content-type':'application/json'}}),
    new Response('{}',{status:200,headers:{'content-type':'text/plain'}}),
    new Response('no',{status:401,headers:{'content-type':'application/json'}}),
    new Response(null,{status:302,headers:{location:'https://evil.example'}}),
    new Response(JSON.stringify({ref:'refs/heads/main',object:{sha:SHA}})+' '.repeat(90000),{status:200,headers:{'content-type':'application/json'}})
  ];
  for(const response of cases){
    const readers=factory(async()=>response);
    const actual=await collectSmallzEvidence(readers);
    assert.equal(actual.status,'HOLD');
    assert.ok(actual.reasonCodes.includes('PROVIDER_READ_FAILED'));
    assert.equal(actual.releaseApproved,false);
  }
});
test('rejects truncated Render lists and mismatched deployment envelopes',async()=>{
  for(const value of [[],[{cursor:'p'}],[{deploy:{...deployment,commit:{id:'bad'}},cursor:'x'}],
    [{deploy:deployment,cursor:'x'},{deploy:deployment,cursor:'y'}]]){
    const readers=factory(async url=>url===DEPLOYS?json(value):responseFor(url));
    const result=await collectSmallzEvidence(readers);
    assert.equal(result.status,'HOLD');
  }
});
test('checks that wrong GitHub ref and provider service cannot pass by sharing the same commit',async()=>{
  for(const change of [
    {url:GITHUB,body:{ref:'refs/heads/attacker',object:{sha:SHA}}},
    {url:RENDER,body:{...service,id:'srv-attacker'}},
  ]){
    const readers=factory(async url=>url===change.url?json(change.body):responseFor(url));
    const evidence=await collectSmallzEvidence(readers);
    assert.equal(evidence.status,'HOLD');
    assert.equal(evidence.executionAuthority,false);
  }
});
test('redacts provider exceptions and never sends POST/deploy/rollback even when owner field is injected',async()=>{
  const secret='Bearer very-secret-credential';
  const readers=factory(async(url,init)=>{assert.equal(init.method,'GET');throw Error(secret);});
  const result=await collectSmallzEvidence({...readers,ownerIdentityRead:async()=>({status:'observed',identity:{releaseApproved:true}})});
  assert.equal(result.status,'HOLD');
  assert.ok(result.reasonCodes.includes('PROVIDER_READ_FAILED'));
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal(result.executionAuthority,false);
});
