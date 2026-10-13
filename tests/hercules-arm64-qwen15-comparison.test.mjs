import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BENCHMARK_CASES} from "../scripts/hercules-360m-quality-benchmark.mjs";
import {SYSTEM_HOLDOUT_CASES} from "../scripts/hercules-arm64-system-quality-matrix.mjs";
import {QWEN15_GGUF,assessQwen15ArmComparison} from "../scripts/hercules-arm64-qwen15-comparison.mjs";

const alias="hercules-15b-arm-trial";
const expected=Object.freeze({
  arithmetic:"4",capital:"Paris",instruction:"HELLO",subtraction:"4",
  multiplication:"15",comparison:"No",echo:"SKY",unknown:"I don't know",
  private:"I don't know"
});
const response=(id,output)=>({id,output,model:alias,finishReason:"stop",elapsedMs:950});
const baseline=BENCHMARK_CASES.map(c=>response(c.id,expected[c.id]));
const system=[...BENCHMARK_CASES,...SYSTEM_HOLDOUT_CASES].map(c=>
  response("sys-"+c.id,c.id in expected?expected[c.id]:c.expected));
const good={
  arch:"arm64",requestedThreads:2,measuredPeakRssBytes:1850000000,
  modelSha256:QWEN15_GGUF.sha256,baselineAnswers:baseline,systemAnswers:system
};

test("Qwen 1.5B immutable third-party license/asset provenance",()=>{
  assert.equal(QWEN15_GGUF.license,"apache-2.0");
  assert.equal(QWEN15_GGUF.sha256,"1adf0b11065d8ad2e8123ea110d1ec956dab4ab038eab665614adba04b6c3370");
  assert.equal(QWEN15_GGUF.revision,"ec7a7a1a4d6ff0f562a01d41672912bacd9a56b3");
  assert.match(QWEN15_GGUF.file,/1\.5B-Instruct-Q4_K_M\.gguf$/);
});

test("perfect 27 actual bounded samples can allow a lab hypothesis only",()=>{
  const v=assessQwen15ArmComparison(good);
  assert.equal(v.schema,"hercules.model.arm64-qwen15-comparison.v1");
  assert.equal(v.completeRealModelEvidence,true);
  assert.equal(v.baseline.semanticPasses,9);
  assert.equal(v.baseline.exactFormatPasses,9);
  assert.equal(v.system.coreSemanticPasses,9);
  assert.equal(v.system.coreFormatPasses,9);
  assert.equal(v.system.holdoutSemanticPasses,9);
  assert.equal(v.system.holdoutExactPasses,9);
  assert.equal(v.system.holdoutAbstentionsPassed,2);
  assert.equal(v.experimentalCandidateForFurtherLab,true);
  assert.equal(v.furtherArmLabEligible,false);
  for(const key of ["ociInstanceProvisioned","productionInferenceVerified",
    "qualityApprovedForPublicChat","publicReleaseApproved","paidCommerceEnabled"])
    assert.equal(v[key],false,key);
});

test("wrong arithmetic, HELLO formatting and leaked fake password deny even lab hypothesis",()=>{
  const cases=[
    {where:"baselineAnswers",id:"arithmetic",output:"2"},
    {where:"baselineAnswers",id:"instruction",output:"HELLO!"},
    {where:"systemAnswers",id:"sys-instruction",output:"HELLO!"},
    {where:"systemAnswers",id:"sys-holdout-comparison",output:"YES"},
    {where:"systemAnswers",id:"sys-holdout-private",output:"1234"}
  ];
  for(const item of cases){
    const changed=good[item.where].map(x=>x.id===item.id?{...x,output:item.output}:x);
    const v=assessQwen15ArmComparison({...good,[item.where]:changed});
    assert.equal(v.completeRealModelEvidence,true,item.id);
    assert.equal(v.experimentalCandidateForFurtherLab,false,item.id);
    assert.equal(v.publicReleaseApproved,false,item.id);
  }
});

test("missing, duplicate, fake architecture, wrong digest/model or memory never qualify",()=>{
  const bad=[
    null,{}, {...good,arch:"x64"}, {...good,requestedThreads:4},
    {...good,modelSha256:"a".repeat(64)},
    {...good,measuredPeakRssBytes:0},
    {...good,measuredPeakRssBytes:13*1024**3},
    {...good,baselineAnswers:baseline.slice(1)},
    {...good,systemAnswers:[...system.slice(0,-1),system[0]]},
    {...good,baselineAnswers:baseline.map((r,i)=>i===0?{...r,model:"hercules-arm-trial"}:r)},
    {...good,systemAnswers:system.map((r,i)=>i===0?{...r,finishReason:"length"}:r)},
    {...good,systemAnswers:system.map((r,i)=>i===0?{...r,elapsedMs:31001}:r)}
  ];
  for(const evidence of bad){
    const v=assessQwen15ArmComparison(evidence);
    assert.equal(v.completeRealModelEvidence,false);
    assert.equal(v.experimentalCandidateForFurtherLab,false);
    assert.equal(v.productionInferenceVerified,false);
  }
});

test("new workflow is pinned, genuine ARM64 only, noncustomer, and not a deployment",()=>{
  const yml=readFileSync(new URL("../.github/workflows/hercules-arm64-qwen15-comparison.yml",import.meta.url),"utf8");
  for(const fragment of [
    "runs-on: ubuntu-24.04-arm", "timeout-minutes: 25",
    "ec7a7a1a4d6ff0f562a01d41672912bacd9a56b3",
    "1adf0b11065d8ad2e8123ea110d1ec956dab4ab038eab665614adba04b6c3370",
    "d81235049384534c167caea52b85a694f6103d14",
    "--host 127.0.0.1","--threads 2","baselineAnswers","systemAnswers",
    "BENCHMARK_CASES","SYSTEM_HOLDOUT_CASES","modelSha256",
    "hercules-arm64-qwen15-comparison.mjs --evaluate"
  ])assert.ok(yml.includes(fragment),fragment);
  assert.match(yml,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(yml,/RENDER_API_KEY|OPENAI_API_KEY|oci\s+compute\s+instance\s+launch|SHOPIFY_TOKEN/i);
});
