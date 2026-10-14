import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runSmallzReadiness} from '../hercules-deploy/smallz-readiness-runner.mjs';

const token=(letter)=>letter.repeat(32);
const env=()=>({
  HERCULES_SMALLZ_EVIDENCE_READ_ENABLED:'true',
  HERCULES_SMALLZ_RENDER_READ_TOKEN:token('r'),
  HERCULES_SMALLZ_GITHUB_READ_TOKEN:token('g'),
});
const serviceId='srv-db08fglg1s2s73d0o2rg',sha='a'.repeat(40);
const GITHUB_MAIN='https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main';
const RENDER_SERVICE='https://api.render.com/v1/services/'+serviceId;
const RENDER_DEPLOYS=RENDER_SERVICE+'/deploys?limit=1';
const service={
  id:serviceId,name:'smallz-hercules',repo:'https://github.com/Sauceapproved7/expert-doodle',
  branch:'main',suspended:'not_suspended',autoDeploy:'no',autoDeployTrigger:'off',
  serviceDetails:{url:'https://smallz-hercules.onrender.com',runtime:'node',plan:'free'}
};
const response=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
const stubFetch=(calls=[])=>async(url,options)=>{
  calls.push({url,method:options.method,auth:options.headers.authorization});
  if(url===GITHUB_MAIN)return response({ref:'refs/heads/main',object:{sha}});
  if(url===RENDER_DEPLOYS)return response([{deploy:{id:'dep-'+'b'.repeat(18),status:'live',commit:{id:sha}}}]);
  if(url===RENDER_SERVICE)return response(service);
  throw Error('unexpected URL');
};
test('readiness runner is disabled by default, makes zero network calls and leaks no credentials',async()=>{
  let calls=0;
  const result=await runSmallzReadiness({env:{...env(),HERCULES_SMALLZ_EVIDENCE_READ_ENABLED:undefined},fetchImpl:async()=>{calls++;throw Error('not authorized')}});
  assert.equal(calls,0);
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.reasonCodes,['READ_ONLY_MODE_DISABLED']);
  assert.equal(result.releaseApproved,false);
  assert.equal(result.executionAuthority,false);
  assert.equal(JSON.stringify(result).includes(token('r')),false);
});
test('missing or malformed dedicated read-only credentials fails closed before any network',async()=>{
  for(const patch of [
    {HERCULES_SMALLZ_RENDER_READ_TOKEN:undefined},
    {HERCULES_SMALLZ_GITHUB_READ_TOKEN:'short'},
    {HERCULES_SMALLZ_GITHUB_READ_TOKEN:undefined},
    {HERCULES_SMALLZ_RENDER_READ_TOKEN:'Bearer should not appear here'}
  ]){
    let calls=0;
    const result=await runSmallzReadiness({env:{...env(),...patch},fetchImpl:async()=>{calls++;throw Error('not authorized')}});
    assert.equal(calls,0);
    assert.equal(result.status,'HOLD');
    assert.deepEqual(result.reasonCodes,['READ_CREDENTIALS_UNAVAILABLE']);
  }
});
test('rejects reusing an existing production write or deploy control token as read-only credential',async()=>{
  for(const unsafe of [
    {HERCULES_RENDER_API_TOKEN:token('r')},
    {HERCULES_DEPLOY_CONTROL_TOKEN:token('g')},
    {HERCULES_RENDER_API_TOKEN:token('g')},
  ]){
    let calls=0;
    const result=await runSmallzReadiness({env:{...env(),...unsafe},fetchImpl:async()=>{calls++;throw Error('not authorized')}});
    assert.equal(result.status,'HOLD');
    assert.deepEqual(result.reasonCodes,['CREDENTIAL_ROLE_COLLISION']);
    assert.equal(calls,0);
  }
});
test('opted-in reader performs only three pinned GET requests and reports no owner verification',async()=>{
  const calls=[];
  const result=await runSmallzReadiness({env:env(),fetchImpl:stubFetch(calls)});
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.reasonCodes,['OWNER_RUNTIME_UNVERIFIED']);
  assert.equal(result.mainCommit,sha);
  assert.equal(result.liveCommit,sha);
  assert.equal(result.readsAttempted,true);
  assert.equal(calls.length,3);
  for(const call of calls){assert.equal(call.method,'GET');assert.match(call.auth,/^Bearer /);}
  assert.equal(result.providerRecordsIndependentlyAuthenticated,false);
  assert.equal(result.ownerAuthorizationVerified,false);
  assert.equal(result.releaseApproved,false);
  assert.equal(result.executionAuthority,false);
  assert.equal(result.productionChanged,false);
  assert.equal(JSON.stringify(result).includes(token('r')),false);
  assert.equal(JSON.stringify(result).includes(token('g')),false);
});
test('a simulated matching provider record is still untrusted; never claim release or owner authority',async()=>{
  const result=await runSmallzReadiness({env:env(),fetchImpl:stubFetch()});
  assert.equal(result.ownerRuntimeRecordAligned,false);
  assert.equal(result.runtimeHealthVerified,false);
  assert.equal(result.providerRecordsIndependentlyAuthenticated,false);
  assert.equal(result.executionAuthority,false);
});
test('network errors are redacted and result in HOLD without stack trace or tokens',async()=>{
  const secret=token('r');
  const result=await runSmallzReadiness({env:env(),fetchImpl:async()=>{throw Error('Authorization: Bearer '+secret)}});
  assert.equal(result.status,'HOLD');
  assert.ok(result.reasonCodes.includes('PROVIDER_READ_FAILED'));
  assert.equal(JSON.stringify(result).includes(secret),false);
  assert.equal(JSON.stringify(result).includes('Authorization: Bearer '),false);
});
test('readiness runner never accepts owner session, arbitrary action, provider URL or payment action',async()=>{
  const calls=[];
  const result=await runSmallzReadiness({
    env:env(),fetchImpl:stubFetch(calls),
    ownerIdentityRead:async()=>{throw Error('unexpected')},
    action:'release.execute',url:'https://evil.test',ownerAuthorization:token('s')
  });
  assert.equal(result.ownerRuntimeRecordAligned,false);
  assert.equal(result.releaseApproved,false);
  assert.equal(result.executionAuthority,false);
  assert.equal(calls.length,3);
});
test('CLI without explicit --read-only switch does not perform reads or print server secrets',()=>{
  const secret=token('r');
  const r=spawnSync(process.execPath,['hercules-deploy/smallz-readiness-runner.mjs'],{
    cwd:process.cwd(),encoding:'utf8',timeout:4000,
    env:{...process.env,HERCULES_SMALLZ_EVIDENCE_READ_ENABLED:'true',HERCULES_SMALLZ_RENDER_READ_TOKEN:secret,HERCULES_SMALLZ_GITHUB_READ_TOKEN:token('g')}
  });
  assert.equal(r.status,2);
  const output=JSON.parse(r.stdout);
  assert.equal(output.status,'HOLD');
  assert.deepEqual(output.reasonCodes,['READ_ONLY_SWITCH_REQUIRED']);
  assert.equal(output.executionAuthority,false);
  assert.equal(r.stdout.includes(secret),false);
  assert.equal(r.stderr.includes(secret),false);
});


test('test transport rejects lookalike provider hosts and arbitrary URLs',async()=>{
  const stub=stubFetch();
  const opts={method:'GET',headers:{authorization:'Bearer synthetic'}};
  for(const url of [
    'https://api.github.com.attacker.invalid/repos/Sauceapproved7/expert-doodle/git/ref/heads/main',
    'https://api.render.com.attacker.invalid/v1/services/srv-db08fglg1s2s73d0o2rg',
    'https://attacker.invalid/v1/services/srv-db08fglg1s2s73d0o2rg/deploys?limit=1',
    'https://attacker.invalid/api.github.com/resource'
  ])await assert.rejects(stub(url,opts),/unexpected URL/,url);
});

test('readiness command must use six GETs and identify a commit change between snapshots',async()=>{
  const calls=[];let index=0;
  const result=await runSmallzReadiness({env:{...env(),HERCULES_SMALLZ_READ_AUDIT_ENABLED:'true'},fetchImpl:async(url,options)=>{
    calls.push({url,method:options.method});
    if(url===GITHUB_MAIN)return response({ref:'refs/heads/main',object:{sha:++index===1?sha:'f'.repeat(40)}});
    return stubFetch()(url,options);
  }});
  assert.equal(index,2);
  assert.equal(calls.length,6);
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.reasonCodes,['PROVIDER_STATE_CHANGED_DURING_READ']);
  assert.equal(result.mainCommit,null);
  assert.equal(result.liveCommit,null);
  assert.equal(result.releaseApproved,false);
  assert.equal(result.executionAuthority,false);
});
test('readiness command refuses to read if underlying audit opt-in is not also explicit',async()=>{
  let calls=0;
  const result=await runSmallzReadiness({env:env(),fetchImpl:async()=>{
    calls++;return response({});
  }});
  assert.equal(calls,0);
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.reasonCodes,['AUDIT_SECOND_OPT_IN_REQUIRED']);
  assert.equal(result.executionAuthority,false);
});
test('readiness command never treats two identical upstream failures as stable evidence',async()=>{
  let calls=0;
  const result=await runSmallzReadiness({env:{...env(),HERCULES_SMALLZ_READ_AUDIT_ENABLED:'true'},fetchImpl:async()=>{
    calls++;throw Error('authorization bearer never expose');
  }});
  assert.equal(result.status,'HOLD');
  assert.ok(result.reasonCodes.includes('PROVIDER_READ_FAILED'));
  assert.equal(result.releaseApproved,false);
  assert.equal(result.executionAuthority,false);
  assert.equal(JSON.stringify(result).includes('never expose'),false);
});
