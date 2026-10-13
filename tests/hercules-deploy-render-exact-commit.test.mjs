import test from 'node:test';
import assert from 'node:assert/strict';
import {planSmallzExactCommitRelease, SMALLZ_RELEASE} from '../hercules-deploy/render-exact-commit.mjs';
const live = 'ac4ebb822e421e4cc3a3b6bbea28330552304d95';
const candidate = '861c8244ef1f86ec8843569e372d6f01abb8aec1';
const validService = {
  id:'srv-db08fglg1s2s73d0o2rg',name:'smallz-hercules',
  repo:'https://github.com/Sauceapproved7/expert-doodle',branch:'main',
  autoDeploy:'no',autoDeployTrigger:'off',suspended:'not_suspended',
  serviceDetails:{runtime:'node',plan:'free',url:'https://smallz-hercules.onrender.com'}
};
const validDeployment = {id:'dep-db6psunf3r2c73c27ph0',status:'live',commit:{id:live}};
const run = (p={})=>planSmallzExactCommitRelease({service:validService,liveDeployment:validDeployment,releaseCommit:candidate,...p});
test('the released candidate and the prior production baseline are pinned to exact 40-byte Git SHAs',()=>{
  assert.equal(SMALLZ_RELEASE.candidateSha,candidate);
  assert.equal(SMALLZ_RELEASE.rollbackSha,live);
  assert.equal(SMALLZ_RELEASE.serviceId,validService.id);
});
test('constructs only the Render API exact-sha request when all provider invariants match',()=>{
  const p=run();
  assert.equal(p.status,'prepared_not_submitted');
  assert.deepEqual(p.request,{method:'POST',url:'https://api.render.com/v1/services/srv-db08fglg1s2s73d0o2rg/deploys',body:{commitId:candidate,clearCache:'do_not_clear',deployMode:'build_and_deploy'}});
  assert.equal(p.expectedPriorDeploymentId,validDeployment.id);
  assert.equal(p.productionChanged,false);
  assert.equal(p.ownerAuthorizationVerified,false);
  assert.equal(p.liveRuntimeVerified,false);
  assert.equal(p.rollbackAuthorized,false);
  assert.equal(p.releaseApproved,false);
});
test('refuses to plan while autodeploy is active or metadata is insufficient',()=>{
  for(const mutation of [{autoDeploy:'yes',autoDeployTrigger:'commit'},{autoDeploy:'yes'},{autoDeployTrigger:'commit'},{autoDeployTrigger:undefined},{autoDeploy:undefined}]){
    const p=run({service:{...validService,...mutation}});
    assert.equal(p.status,'held',JSON.stringify(mutation));
    assert.equal(p.request,null);
  }
});
test('refuses off-target or suspended services before constructing any release request',()=>{
  const mutations=[{id:'srv-not-owned'},{name:'smallz-copy'},{branch:'staging'},{repo:'https://github.com/other/repo'},{suspended:'suspended'},{serviceDetails:{...validService.serviceDetails,url:'https://attacker.example'}},{serviceDetails:{...validService.serviceDetails,plan:'starter'}}];
  for(const mutation of mutations){const p=run({service:{...validService,...mutation}});assert.equal(p.status,'held');assert.equal(p.request,null)}
});
test('refuses stale, malformed or no longer live provider deployment snapshots',()=>{
  const changes=[{id:'dep-another'},{status:'queued'},{status:'live',commit:{id:'b'.repeat(40)}},{status:'live',commit:{id:'deadbeef'}}];
  for(const v of changes){const p=run({liveDeployment:{...validDeployment,...v}});assert.equal(p.status,'held');assert.equal(p.request,null)}
});
test('refuses any unapproved candidate, short SHA, mismatched branch or extra requests',()=>{
  for(const sha of ['main','861c8244',live,'b'.repeat(40),'ABCDEF1234567890'.repeat(3),null]){
    const p=run({releaseCommit:sha});assert.equal(p.status,'held');assert.equal(p.request,null);
  }
});
test('never reads secrets, opens a network connection or claims deployment success',()=>{
  const p=run({releaseCommit:candidate,authorization:'Bearer SECRET-test',payload:{secret:'exfil'}});
  assert.equal(JSON.stringify(p).includes('SECRET-test'),false);
  assert.equal(JSON.stringify(p).includes('exfil'),false);
  assert.equal(p.executionAuthority,false);
  assert.equal(p.rollbackAuthorized,false);
});
test('invalid or missing provider evidence fails closed',()=>{
  for(const x of [null,{},[],false]){
    const p=planSmallzExactCommitRelease(x);
    assert.equal(p.status,'held');assert.equal(p.request,null);
  }
});
