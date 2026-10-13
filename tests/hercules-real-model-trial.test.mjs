import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  HERCULES_TRIAL_MODEL,
  evaluateRealModelTrial,
} from "../scripts/hercules-real-model-trial.mjs";

const passing={
  measuredPeakRssKb:320000,
  answers:[
    {id:"arithmetic",output:"4"},
    {id:"capital",output:"Paris."},
    {id:"instruction",output:"HELLO"},
  ]
};

test("pinned external checkpoint never becomes SauceApproved-owned weights",()=>{
  assert.equal(HERCULES_TRIAL_MODEL.source,"QuantFactory/SmolLM2-135M-Instruct-GGUF");
  assert.equal(HERCULES_TRIAL_MODEL.license,"apache-2.0");
  assert.equal(HERCULES_TRIAL_MODEL.bytes,105454144);
  assert.equal(HERCULES_TRIAL_MODEL.sha256,"8030f04528538d47bda434f6f0bdf3952c40a58123e4d5e755332f23731a8684");
  assert.match(HERCULES_TRIAL_MODEL.url,/\/resolve\/[a-f0-9]{40}\/SmolLM2-135M-Instruct\.Q4_K_M\.gguf$/);
});

test("actual samples can qualify a bounded lab experiment but never public launch",()=>{
  const result=evaluateRealModelTrial(passing,{ramLimitBytes:512*1024*1024});
  assert.equal(result.sampleChecksPassed,3);
  assert.equal(result.sampleChecksTotal,3);
  assert.equal(result.experimentalEligible,true);
  assert.equal(result.chatInferenceVerifiedForProduction,false);
  assert.equal(result.publicReleaseApproved,false);
  assert.equal(result.paidCommerceEnabled,false);
});

test("missing or unmeasured data fails closed",()=>{
  for(const item of [
    null, {},{...passing,measuredPeakRssKb:null},
    {...passing,answers:[]},
    {...passing,answers:[{id:"arithmetic",output:"4"}]}
  ]){
    assert.equal(evaluateRealModelTrial(item,{ramLimitBytes:512*1024*1024}).experimentalEligible,false);
  }
});

test("nonsense, hallucinated and blank outputs do not qualify",()=>{
  for(const answers of [
    [{id:"arithmetic",output:"42"},{id:"capital",output:"Paris"},{id:"instruction",output:"HELLO"}],
    [{id:"arithmetic",output:"4"},{id:"capital",output:"London"},{id:"instruction",output:"HELLO"}],
    [{id:"arithmetic",output:"4"},{id:"capital",output:"Paris"},{id:"instruction",output:""}],
    [{id:"arithmetic",output:"4"},{id:"capital",output:"Paris"},{id:"instruction",output:"hell0"}],
  ]){
    const result=evaluateRealModelTrial({...passing,answers},{ramLimitBytes:512*1024*1024});
    assert.equal(result.experimentalEligible,false);
  }
});

test("measured resident memory over Render free RAM fails isolated qualification",()=>{
  const result=evaluateRealModelTrial({...passing,measuredPeakRssKb:700000},{ramLimitBytes:512*1024*1024});
  assert.equal(result.experimentalEligible,false);
  assert.equal(result.memoryWithinLimit,false);
});

test("candidate qualification workflow is pinned and never performs production cutover",()=>{
  const yaml=readFileSync(new URL("../.github/workflows/hercules-real-model-trial.yml",import.meta.url),"utf8");
  assert.match(yaml,/runs-on: ubuntu-24\.04/);
  assert.match(yaml,/timeout-minutes: 20/);
  assert.match(yaml,/8030f04528538d47bda434f6f0bdf3952c40a58123e4d5e755332f23731a8684/);
  assert.match(yaml,/d81235049384534c167caea52b85a694f6103d14/);
  assert.match(yaml,/read-only real-model evidence|real-model laboratory/i);
  assert.doesNotMatch(yaml,/(?:render\.com\/api|railway\.app\/graphql|supabase\.co\/functions\/v1|OPENAI_API_KEY|HF_TOKEN)/);
});
