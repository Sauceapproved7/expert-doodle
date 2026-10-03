import test from 'node:test';
import assert from 'node:assert/strict';
import {createRealityForgeManifest,buildRealityTransformationPlan} from '../sauceapproved-studio/reality-forge/core.mjs';

test('Reality Forge advertises protected transformation controls',()=>{
  const manifest=createRealityForgeManifest();
  assert.equal(manifest.product,'Hercules Reality Forge');
  assert.deepEqual(manifest.differentiators,['Reality Lock','Continuity Guardian']);
  assert.equal(manifest.executionPolicy,'plan-proof-transform-fail-closed');
  assert.equal(manifest.autoPublish,false);
});

test('blocks transformation when protected identity proof is missing',()=>{
  const plan=buildRealityTransformationPlan({title:'1970s Brooklyn',goal:'turn present-day footage into a 1970s street scene',protectedSubjects:['lead'],shots:[{id:'s1',subject:'lead'}]});
  assert.equal(plan.executionReady,false);
  assert.ok(plan.blockers.some(x=>x.code==='protected_identity_proof_required'));
});

test('continuity guardian detects conflicting locked continuity facts',()=>{
  const plan=buildRealityTransformationPlan({title:'Rain sequence',goal:'transform location and weather',identityProof:true,protectedSubjects:['lead'],shots:[
    {id:'s1',subject:'lead',continuity:{wardrobe:'black coat',weather:'rain'}},
    {id:'s2',subject:'lead',continuity:{wardrobe:'red coat',weather:'rain'}}
  ]});
  assert.equal(plan.continuityGuardian.ok,false);
  assert.ok(plan.continuityGuardian.conflicts.some(x=>x.dimension==='wardrobe'));
  assert.equal(plan.executionReady,false);
});

test('safe plan stays non-mutating until proof gates clear',()=>{
  const plan=buildRealityTransformationPlan({title:'Moonlight block',goal:'relight and restyle approved footage',identityProof:true,protectedSubjects:['lead'],shots:[
    {id:'s1',subject:'lead',continuity:{wardrobe:'black coat',weather:'clear'}},
    {id:'s2',subject:'lead',continuity:{wardrobe:'black coat',weather:'clear'}}
  ]});
  assert.equal(plan.planReady,true);
  assert.equal(plan.executionReady,false);
  assert.equal(plan.publishReady,false);
  assert.equal(plan.mutationAttempted,false);
});
