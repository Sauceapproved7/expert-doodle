import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceLabManifest,buildPerformancePlan} from '../sauceapproved-studio/performance-lab/core.mjs';

test('Performance Lab exposes owned performance safeguards',()=>{
 const m=createPerformanceLabManifest();
 assert.equal(m.product,'Hercules Performance Lab');
 assert.deepEqual(m.differentiators,['Performance DNA','Actor Continuity Engine']);
 assert.equal(m.executionPolicy,'consent-plan-proof-perform-fail-closed');
 assert.equal(m.autoPublish,false);
});
test('real-person likeness or synthetic voice requires consent proof',()=>{
 const p=buildPerformancePlan({title:'Lead read',character:'Lead',usesRealPersonLikeness:true,usesSyntheticVoice:true,beats:[{id:'b1',emotion:'calm',voice:'warm',blocking:'mark-a'}]});
 assert.equal(p.executionReady,false);
 assert.ok(p.blockers.some(x=>x.code==='likeness_consent_required'));
 assert.ok(p.blockers.some(x=>x.code==='voice_consent_required'));
});
test('Actor Continuity Engine detects unexplained performance drift',()=>{
 const p=buildPerformancePlan({title:'Scene',character:'Hero',consentProof:true,beats:[
  {id:'b1',emotion:'calm',voice:'low',blocking:'mark-a'},
  {id:'b2',emotion:'rage',voice:'high',blocking:'mark-b'}
 ]});
 assert.equal(p.actorContinuity.ok,false);
 assert.ok(p.actorContinuity.drift.length>0);
});
test('approved performance DNA stays planned and non-mutating until proof review',()=>{
 const p=buildPerformancePlan({title:'Scene',character:'Hero',consentProof:true,beats:[
  {id:'b1',emotion:'focused',voice:'steady',blocking:'mark-a'},
  {id:'b2',emotion:'focused',voice:'steady',blocking:'mark-a'}
 ]});
 assert.equal(p.planReady,true);
 assert.equal(p.executionReady,false);
 assert.equal(p.publishReady,false);
 assert.equal(p.mutationAttempted,false);
});
