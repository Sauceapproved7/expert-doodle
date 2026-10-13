import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HERCULES_360M_MODEL, assess360mTrial} from "../scripts/hercules-smollm2-360m-trial.mjs";

const good={measuredPeakRssKb:320000,answers:[
  {id:"arithmetic",output:"4"},
  {id:"capital",output:"Paris"},
  {id:"instruction",output:"HELLO"}
]};

test("second model's upstream provenance, exact immutable revision, size and checksum are explicit",()=>{
  assert.equal(HERCULES_360M_MODEL.source,"bartowski/SmolLM2-360M-Instruct-GGUF");
  assert.equal(HERCULES_360M_MODEL.revision,"7be6f65f1db715fe5dc5a4634c0d459b4eed42ec");
  assert.equal(HERCULES_360M_MODEL.sha256,"2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2");
  assert.equal(HERCULES_360M_MODEL.bytes,270590880);
  assert.equal(HERCULES_360M_MODEL.license,"apache-2.0");
});

test("even perfect observed trial never approves Hercules production",()=>{
  const result=assess360mTrial(good);
  assert.equal(result.candidate,"SmolLM2-360M-Instruct.Q4_K_M.gguf");
  assert.equal(result.experimentalEligible,true);
  assert.equal(result.sampleChecksPassed,3);
  assert.equal(result.publicReleaseApproved,false);
  assert.equal(result.chatInferenceVerifiedForProduction,false);
  assert.equal(result.paidCommerceEnabled,false);
});

test("over-limit memory or failure fails closed without launch approval",()=>{
  for(const evidence of [
    {...good,measuredPeakRssKb:600000},
    {...good,measuredPeakRssKb:null},
    {...good,answers:[{id:"arithmetic",output:"18"}]},
  ]){
    const result=assess360mTrial(evidence);
    assert.equal(result.experimentalEligible,false);
    assert.equal(result.publicReleaseApproved,false);
  }
});

test("bounded no-credential CI workflow uses exact external content-addressed model",()=>{
  const yaml=readFileSync(new URL("../.github/workflows/hercules-smollm2-360m-trial.yml",import.meta.url),"utf8");
  for(const required of [
    "ubuntu-24.04","timeout-minutes: 20",
    HERCULES_360M_MODEL.revision,
    HERCULES_360M_MODEL.sha256,
    String(HERCULES_360M_MODEL.bytes),
    "d81235049384534c167caea52b85a694f6103d14"
  ])assert.ok(yaml.includes(required),"missing pin/control "+required);
  assert.match(yaml,/permissions:\s*\n\s*contents: read/);
  assert.match(yaml,/\/tmp\/hercules-360m\//);
  assert.match(yaml,/127\.0\.0\.1/);
  const downloadCap=/--max-filesize\s+(\d+)/.exec(yaml);
  assert.ok(downloadCap,"download size must be bounded");
  assert.ok(Number(downloadCap[1]) >= HERCULES_360M_MODEL.bytes,
    "download bound must accommodate the exact verified 360M model");
  assert.doesNotMatch(yaml,/OPENAI_API_KEY|HF_TOKEN|render\.com\/api|railway\.app\/graphql|supabase\.co\/functions/);
});
