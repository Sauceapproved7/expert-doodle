import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BENCHMARK_CASES} from "../scripts/hercules-360m-quality-benchmark.mjs";
import {
  SYSTEM_HOLDOUT_CASES, systemQualityMessages, assessSystemQualityMatrix
} from "../scripts/hercules-arm64-system-quality-matrix.mjs";

const core=BENCHMARK_CASES.map(c=>({
  id:c.id, output:({
    arithmetic:"4",capital:"Paris",instruction:"HELLO",subtraction:"4",
    multiplication:"15",comparison:"No",echo:"SKY",unknown:"I don't know",private:"I don't know"
  })[c.id],model:"hercules-arm-trial",finishReason:"stop",elapsedMs:500
}));
const holdouts=SYSTEM_HOLDOUT_CASES.map(c=>({
  id:c.id,output:c.expected,model:"hercules-arm-trial",finishReason:"stop",elapsedMs:650
}));
const good={
  arch:"arm64",requestedThreads:2,measuredPeakRssBytes:450000000,
  answers:[...core,...holdouts]
};

test("general instruction does not include held-out answers and preserves actual user prompts",()=>{
  assert.equal(BENCHMARK_CASES.length,9);
  assert.equal(SYSTEM_HOLDOUT_CASES.length,9);
  assert.equal(new Set(SYSTEM_HOLDOUT_CASES.map(x=>x.id)).size,9);
  assert.equal(SYSTEM_HOLDOUT_CASES.filter(x=>x.kind==="abstain").length,2);
  const messages=systemQualityMessages("What is 16 + 7? Output digits only.");
  assert.deepEqual(messages.map(x=>x.role),["system","user"]);
  assert.equal(messages[1].content,"What is 16 + 7? Output digits only.");
  assert.doesNotMatch(messages[0].content,/16|7|23|RIVER|Rome|ZEBRA/);
  assert.match(messages[0].content,/format/i);
  assert.throws(()=>systemQualityMessages(""));
  assert.throws(()=>systemQualityMessages(null));
});

test("full 18-case evidence only allows laboratory hypothesis and never launch",()=>{
  const v=assessSystemQualityMatrix(good);
  assert.equal(v.schema,"hercules.model.arm64-system-quality-matrix.v1");
  assert.equal(v.completeRealModelEvidence,true);
  assert.equal(v.coreSemanticPasses,9);
  assert.equal(v.coreFormatPasses,9);
  assert.equal(v.holdoutSemanticPasses,9);
  assert.equal(v.holdoutExactPasses,9);
  assert.equal(v.holdoutAbstentionsPassed,2);
  assert.equal(v.systemPromptCandidateForFurtherLab,true);
  assert.equal(v.furtherArmLabEligible,false);
  assert.equal(v.ociInstanceProvisioned,false);
  assert.equal(v.qualityApprovedForPublicChat,false);
  assert.equal(v.productionInferenceVerified,false);
  assert.equal(v.publicReleaseApproved,false);
  assert.equal(v.paidCommerceEnabled,false);
});

test("wrong core math, format, holdout facts or guessed secret prevent even a lab hypothesis",()=>{
  for(const mutation of [
    {id:"arithmetic",output:"2"}, {id:"instruction",output:"Hello!"},
    {id:"instruction",output:"HELLO."}, {id:"instruction",output:"hello"},
    {id:"echo",output:"SKY."}, {id:"echo",output:"sky"},
    {id:"holdout-sum",output:"24"}, {id:"holdout-rome",output:"Milan"},
    {id:"holdout-river",output:"River."},
    {id:"holdout-private",output:"The PIN is 1234"},
    {id:"holdout-unknown",output:"Mayor Sirius"}
  ]){
    const changed=good.answers.map(x=>x.id===mutation.id?{...x,output:mutation.output}:x);
    const v=assessSystemQualityMatrix({...good,answers:changed});
    assert.equal(v.systemPromptCandidateForFurtherLab,false,mutation.id);
    assert.equal(v.publicReleaseApproved,false);
  }
});

test("missing, duplicated, wrong-hardware, wrong-model and truncated evidence fail closed",()=>{
  const failures=[
    null,{}, {...good,arch:"x64"},{...good,requestedThreads:4},
    {...good,measuredPeakRssBytes:0},{...good,measuredPeakRssBytes:7*1024**3},
    {...good,answers:good.answers.slice(1)},
    {...good,answers:[...good.answers.slice(0,-1),good.answers[0]]},
    {...good,answers:good.answers.map((x,i)=>i===1?{...x,model:"unapproved-model"}:x)},
    {...good,answers:good.answers.map((x,i)=>i===1?{...x,finishReason:"length"}:x)},
    {...good,answers:good.answers.map((x,i)=>i===1?{...x,elapsedMs:31000}:x)},
    {...good,answers:good.answers.map((x,i)=>i===1?{...x,output:""}:x)}
  ];
  for(const evidence of failures){
    const v=assessSystemQualityMatrix(evidence);
    assert.equal(v.completeRealModelEvidence,false);
    assert.equal(v.systemPromptCandidateForFurtherLab,false);
    assert.equal(v.qualityApprovedForPublicChat,false);
  }
});

test("workflow maintains original nine and HELLO experiments, then runs full quality matrix separately",()=>{
  const yml=readFileSync(new URL("../.github/workflows/hercules-arm64-nine-quality.yml",import.meta.url),"utf8");
  for(const value of [
    "BENCHMARK_CASES","HELLO_PROBES","SYSTEM_HOLDOUT_CASES",
    "systemQualityMessages","system-quality-answers.json",
    "system-quality-evidence.json",
    "scripts/hercules-arm64-nine-quality.mjs --evaluate",
    "scripts/hercules-arm64-format-probe.mjs --evaluate",
    "scripts/hercules-arm64-system-quality-matrix.mjs --evaluate",
    "runs-on: ubuntu-24.04-arm","--threads 2","--host 127.0.0.1",
    "permissions:\n  contents: read"
  ])assert.ok(yml.includes(value),value);
  assert.doesNotMatch(yml,/RENDER_API_KEY|OPENAI_API_KEY|oci\s+compute\s+instance\s+launch/i);
});
