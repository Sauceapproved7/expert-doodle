import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {runSmallzReleaseReadAudit} from '../hercules-deploy/smallz-read-audit.mjs';

const LIVE='ac4ebb822e421e4cc3a3b6bbea28330552304d95';
const MAIN='4ee061e2cfcb02f3a27ab58fba498c651aeda8c1';
const SERVICE='srv-db08fglg1s2s73d0o2rg';
const GH='https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main';
const RENDER='https://api.render.com/v1/services/'+SERVICE;
const ENV={
  HERCULES_SMALLZ_READ_AUDIT_ENABLED:'true',
  HERCULES_SMALLZ_RENDER_READ_TOKEN:'r'.repeat(32),
  HERCULES_SMALLZ_GITHUB_READ_TOKEN:'g'.repeat(32),
};
function json(x){return new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}})}
const fake=(url,req)=>{
  assert.equal(req.method,'GET');
  assert.equal(req.redirect,'error');
  if(url===GH)return json({ref:'refs/heads/main',object:{sha:MAIN}});
  if(url===RENDER)return json({
    id:SERVICE,name:'smallz-hercules',repo:'https://github.com/Sauceapproved7/expert-doodle',
    branch:'main',suspended:'not_suspended',autoDeploy:'yes',autoDeployTrigger:'commit',
    serviceDetails:{url:'https://smallz-hercules.onrender.com',runtime:'node',plan:'free'}
  });
  if(url===RENDER+'/deploys?limit=1')return json([{deploy:{
    id:'dep-db6psunf3r2c73c27ph0',status:'live',commit:{id:LIVE}
  },cursor:'secret-hidden'}]);
  throw Error('unexpected outbound request');
};

test('audit disabled by default, makes no request, never claims production success',async()=>{
  let calls=0;
  const x=await runSmallzReleaseReadAudit({env:{},fetchImpl:async()=>{calls++;throw Error('called')}});
  assert.equal(calls,0);
  assert.equal(x.status,'DISABLED');
  assert.deepEqual(x.reasonCodes,['AUDIT_DISABLED']);
  assert.equal(x.productionChanged,false);
  assert.equal(x.releaseApproved,false);
  assert.equal(x.executionAuthority,false);
});
test('explicit enabled audit with missing separate read tokens fails closed before network',async()=>{
  let calls=0;
  for(const env of [
    {HERCULES_SMALLZ_READ_AUDIT_ENABLED:'true'},
    {...ENV,HERCULES_SMALLZ_RENDER_READ_TOKEN:undefined},
    {...ENV,HERCULES_SMALLZ_GITHUB_READ_TOKEN:undefined},
    {...ENV,HERCULES_SMALLZ_GITHUB_READ_TOKEN:'short'},
  ]){
    const x=await runSmallzReleaseReadAudit({env,fetchImpl:async()=>{calls++;return json({})}});
    assert.equal(x.status,'HOLD');
    assert.ok(x.reasonCodes.includes('DEDICATED_READ_CREDENTIALS_REQUIRED'));
  }
  assert.equal(calls,0);
});
test('non-exact opt-in does not permit credential reading or network activity',async()=>{
  let calls=0;
  for(const flag of ['yes','TRUE','1',true,null]){
    const x=await runSmallzReleaseReadAudit({env:{...ENV,HERCULES_SMALLZ_READ_AUDIT_ENABLED:flag},fetchImpl:async()=>{calls++;throw Error('unexpected')}});
    assert.equal(x.status,'DISABLED');
    assert.equal(x.executionAuthority,false);
  }
  assert.equal(calls,0);
});
test('rejects reuse of deployer write token, control token and same provider credentials',async()=>{
  let calls=0;
  const cases=[
    {...ENV,HERCULES_RENDER_API_TOKEN:ENV.HERCULES_SMALLZ_RENDER_READ_TOKEN},
    {...ENV,HERCULES_DEPLOY_CONTROL_TOKEN:ENV.HERCULES_SMALLZ_RENDER_READ_TOKEN},
    {...ENV,HERCULES_RENDER_API_TOKEN:ENV.HERCULES_SMALLZ_GITHUB_READ_TOKEN},
    {...ENV,HERCULES_SMALLZ_GITHUB_READ_TOKEN:ENV.HERCULES_SMALLZ_RENDER_READ_TOKEN},
  ];
  for(const env of cases){
    const x=await runSmallzReleaseReadAudit({env,fetchImpl:async()=>{calls++;return json({})}});
    assert.equal(x.status,'HOLD');
    assert.ok(x.reasonCodes.includes('CREDENTIAL_BOUNDARY_VIOLATION'));
  }
  assert.equal(calls,0);
});
test('explicit audit uses only three fixed GETs and returns limited mismatch evidence',async()=>{
  const calls=[];
  const result=await runSmallzReleaseReadAudit({env:ENV,fetchImpl:async(url,req)=>{
    calls.push({url,method:req.method,auth:req.headers.authorization});
    return fake(url,req);
  }});
  assert.deepEqual(calls.map(x=>x.url).sort(),[GH,RENDER,RENDER+'/deploys?limit=1'].sort());
  assert.equal(result.status,'HOLD');
  assert.equal(result.mainCommit,MAIN);
  assert.equal(result.liveCommit,LIVE);
  for(const reason of ['AUTO_DEPLOY_ACTIVE','MAIN_DEPLOY_SHA_MISMATCH','OWNER_RUNTIME_UNVERIFIED']) assert.ok(result.reasonCodes.includes(reason));
  assert.equal(result.providerRecordsIndependentlyAuthenticated,false);
  assert.equal(result.ownerAuthorizationVerified,false);
  assert.equal(result.executionAuthority,false);
  assert.equal(result.releaseApproved,false);
  assert.equal(result.productionChanged,false);
  assert.ok(!JSON.stringify(result).includes('g'.repeat(32)));
  assert.ok(!JSON.stringify(result).includes('r'.repeat(32)));
});
test('provider exceptions or secret-looking errors never appear in audit output',async()=>{
  const secret='Bearer clandestine-value-which-should-not-be-returned';
  const output=await runSmallzReleaseReadAudit({env:ENV,fetchImpl:async()=>{throw Error(secret)}});
  assert.equal(output.status,'HOLD');
  assert.ok(output.reasonCodes.includes('PROVIDER_READ_FAILED'));
  assert.ok(!JSON.stringify(output).includes(secret));
});
test('extra caller fields cannot invent owner proof, approval or write authority',async()=>{
  const output=await runSmallzReleaseReadAudit({
    env:{...ENV,HERCULES_SMALLZ_READ_AUDIT_ENABLED:'true'},
    ownerRead:async()=>({status:'observed',releaseApproved:true}),
    request:{method:'POST',url:'https://api.render.com/v1/services/'+SERVICE+'/deploys'},
    fetchImpl:fake
  });
  assert.equal(output.status,'HOLD');
  assert.equal(output.ownerAuthorizationVerified,false);
  assert.equal(output.releaseApproved,false);
  assert.equal(output.executionAuthority,false);
});


test('one-shot audit operator command is disabled without consent and fails closed when credentials are missing',()=>{
  const baseEnv={PATH:process.env.PATH||'',HERCULES_SMALLZ_READ_AUDIT_ENABLED:'false'};
  const command=['scripts/hercules-smallz-read-audit.mjs'];
  const disabled=spawnSync(process.execPath,command,{cwd:process.cwd(),env:baseEnv,encoding:'utf8',timeout:3000});
  assert.equal(disabled.status,0,disabled.stderr);
  assert.equal(JSON.parse(disabled.stdout).status,'DISABLED');
  const missing=spawnSync(process.execPath,command,{cwd:process.cwd(),env:{...baseEnv,HERCULES_SMALLZ_READ_AUDIT_ENABLED:'true'},encoding:'utf8',timeout:3000});
  assert.equal(missing.status,2,missing.stderr);
  const result=JSON.parse(missing.stdout);
  assert.deepEqual(result.reasonCodes,['DEDICATED_READ_CREDENTIALS_REQUIRED']);
  assert.equal(result.executionAuthority,false);
  assert.equal(result.productionChanged,false);
});
