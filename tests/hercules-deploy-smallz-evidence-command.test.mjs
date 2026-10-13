import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSmallzFromRuntime,runSmallzEvidenceReadCommand} from '../hercules-deploy/smallz-evidence-command.mjs';

const SHA='a'.repeat(40);
const OTHER='b'.repeat(40);
const service={
  id:'srv-db08fglg1s2s73d0o2rg',name:'smallz-hercules',
  repo:'https://github.com/Sauceapproved7/expert-doodle',branch:'main',
  suspended:'not_suspended',autoDeploy:'yes',autoDeployTrigger:'commit',
  serviceDetails:{url:'https://smallz-hercules.onrender.com',runtime:'node',plan:'free'}
};
const deployment={id:'dep-'+('a'.repeat(18)),status:'live',commit:{id:SHA}};
const readEnv={
  HERCULES_SMALLZ_RENDER_READ_TOKEN:'render-only-secret-12345678901234567890',
  HERCULES_SMALLZ_GITHUB_READ_TOKEN:'github-only-secret-12345678901234567890',
};
const renderURL='https://api.render.com/v1/services/srv-db08fglg1s2s73d0o2rg';
const githubURL='https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main';
function reply(data){
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
}
function fakeFetch(log){
  return async(url,options)=>{
    log.push({url,method:options.method,authorization:options.headers.authorization});
    if(url===renderURL)return reply(service);
    if(url===renderURL+'/deploys?limit=1')return reply([{deploy:deployment,cursor:'do-not-include-cursor'}]);
    if(url===githubURL)return reply({ref:'refs/heads/main',object:{sha:OTHER}});
    throw Error('unexpected destination');
  };
}

test('missing or partially configured dedicated credentials cause zero requests',async()=>{
  for(const env of [{},{HERCULES_SMALLZ_RENDER_READ_TOKEN:readEnv.HERCULES_SMALLZ_RENDER_READ_TOKEN},
    {HERCULES_SMALLZ_GITHUB_READ_TOKEN:readEnv.HERCULES_SMALLZ_GITHUB_READ_TOKEN}]){
    let count=0;
    const result=await inspectSmallzFromRuntime({env,fetchImpl:async()=>{count++;throw Error('must not run')}});
    assert.equal(count,0);
    assert.equal(result.status,'HOLD');
    assert.deepEqual(result.reasonCodes,['DEDICATED_READ_CREDENTIALS_UNAVAILABLE']);
    assert.equal(result.evidence,null);
    assert.equal(result.providerQueriesAttempted,false);
    assert.equal(result.executionAuthority,false);
    assert.equal(JSON.stringify(result).includes('secret'),false);
  }
});
test('malformed and unapproved credential fallback fields never trigger provider requests',async()=>{
  for(const env of [
    {...readEnv,HERCULES_SMALLZ_RENDER_READ_TOKEN:'short'},
    {...readEnv,HERCULES_SMALLZ_GITHUB_READ_TOKEN:'token with whitespace'},
    {HERCULES_RENDER_API_TOKEN:'write-capable-secret-12345678901234567890',GITHUB_TOKEN:'legacy-secret-12345678901234567890'}
  ]){
    let calls=0;
    const result=await inspectSmallzFromRuntime({env,fetchImpl:async()=>{calls++;throw Error('no request')}});
    assert.equal(calls,0);
    assert.equal(result.status,'HOLD');
    assert.equal(result.evidence,null);
  }
});
test('dedicated server credentials feed only fixed GitHub and Render GET requests',async()=>{
  const seen=[];
  const result=await inspectSmallzFromRuntime({env:readEnv,fetchImpl:fakeFetch(seen)});
  assert.deepEqual(seen.map(x=>x.url).sort(),[githubURL,renderURL,renderURL+'/deploys?limit=1'].sort());
  assert.ok(seen.every(x=>x.method==='GET'));
  assert.equal(result.status,'HOLD');
  assert.ok(result.reasonCodes.includes('MAIN_DEPLOY_SHA_MISMATCH'));
  assert.ok(result.reasonCodes.includes('AUTO_DEPLOY_ACTIVE'));
  assert.ok(result.reasonCodes.includes('OWNER_RUNTIME_UNVERIFIED'));
  assert.equal(result.evidence.liveCommit,SHA);
  assert.equal(result.evidence.mainCommit,OTHER);
  assert.equal(result.providerQueriesAttempted,true);
  assert.equal(result.evidence.ownerAuthorizationVerified,false);
  assert.equal(result.evidence.providerRecordsIndependentlyAuthenticated,false);
  assert.equal(result.executionAuthority,false);
  const serialized=JSON.stringify(result);
  assert.equal(serialized.includes(readEnv.HERCULES_SMALLZ_RENDER_READ_TOKEN),false);
  assert.equal(serialized.includes(readEnv.HERCULES_SMALLZ_GITHUB_READ_TOKEN),false);
  assert.equal(serialized.includes('do-not-include-cursor'),false);
});
test('provider failures return a sanitized hold, without credential or error message leakage',async()=>{
  for(const response of [async()=>{throw Error('token='+readEnv.HERCULES_SMALLZ_RENDER_READ_TOKEN)},async()=>new Response('not authorized',{status:401})]){
    const result=await inspectSmallzFromRuntime({env:readEnv,fetchImpl:response});
    assert.equal(result.status,'HOLD');
    assert.ok(result.reasonCodes.includes('PROVIDER_READ_FAILED'));
    assert.equal(JSON.stringify(result).includes(readEnv.HERCULES_SMALLZ_RENDER_READ_TOKEN),false);
    assert.equal(result.productionChanged,false);
    assert.equal(result.releaseApproved,false);
  }
});
test('CLI refuses unexpected args before any token lookup or provider fetch',async()=>{
  let calls=0,output='';
  const code=await runSmallzEvidenceReadCommand({
    argv:['--url','https://evil.example/'],env:readEnv,
    fetchImpl:async()=>{calls++;throw Error('should not be called')},
    write:text=>{output+=text}
  });
  assert.equal(code,2);
  assert.equal(calls,0);
  const record=JSON.parse(output);
  assert.equal(record.status,'HOLD');
  assert.deepEqual(record.reasonCodes,['UNSUPPORTED_ARGUMENTS']);
  assert.equal(record.executionAuthority,false);
});
test('CLI emits only a single bounded JSON object and marks unverified live drift as hold',async()=>{
  let output='';
  const code=await runSmallzEvidenceReadCommand({
    argv:['--json'],env:readEnv,fetchImpl:fakeFetch([]),
    write:text=>{output+=text}
  });
  assert.equal(code,2);
  const obj=JSON.parse(output);
  assert.equal(obj.status,'HOLD');
  assert.equal(obj.schema,'sauceapproved.hercules.smallz-evidence-command.v1');
  assert.equal(obj.evidence.liveCommit,SHA);
  assert.equal(obj.productionChanged,false);
  assert.equal(obj.executionAuthority,false);
  assert.equal(output.includes(readEnv.HERCULES_SMALLZ_GITHUB_READ_TOKEN),false);
});
test('server environment values are not echoed to output even when a getter fails',async()=>{
  const env={get HERCULES_SMALLZ_RENDER_READ_TOKEN(){throw Error('secret-render-detail')}};
  const r=await inspectSmallzFromRuntime({env,fetchImpl:async()=>{throw Error('not called')}});
  assert.equal(r.status,'HOLD');
  assert.equal(JSON.stringify(r).includes('secret-render-detail'),false);
});
