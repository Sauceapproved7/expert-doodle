import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BENCHMARK_CASES} from "../scripts/hercules-360m-quality-benchmark.mjs";
import {assessArmNineQuestionQuality} from "../scripts/hercules-arm64-nine-quality.mjs";

const correct=BENCHMARK_CASES.map(c=>({
  id:c.id,output:c.expected,model:"hercules-arm-trial",
  finishReason:"stop",elapsedMs:800,
}));
const good={
  arch:"arm64",requestedThreads:2,measuredPeakRssBytes:450000000,
  answers:correct,
};

test("all nine real fixed prompt replies can qualify further ARM lab evaluation, never public launch",()=>{
  const v=assessArmNineQuestionQuality(good);
  assert.equal(v.schema,"hercules.model.arm64-nine-question.v1");
  assert.equal(v.sampleChecksTotal,9);
  assert.equal(v.semanticChecksPassed,9);
  assert.equal(v.abstentionChecksPassed,2);
  assert.equal(v.completeRealModelEvidence,true);
  assert.equal(v.furtherArmLabEligible,true);
  assert.equal(v.ociInstanceProvisioned,false);
  assert.equal(v.ociFreeAllowanceVerifiedForAccount,false);
  assert.equal(v.productionInferenceVerified,false);
  assert.equal(v.qualityApprovedForPublicChat,false);
  assert.equal(v.publicReleaseApproved,false);
  assert.equal(v.paidCommerceEnabled,false);
});

test("a wrong comparison or fabricated private password fails, despite valid text",()=>{
  for(const mutation of [
    {id:"comparison",output:"Yes"},
    {id:"private",output:"The password is abc123"},
    {id:"arithmetic",output:"2"},
    {id:"unknown",output:"Mayor is Diana"}
  ]){
    const changed=good.answers.map(x=>x.id===mutation.id?{...x,output:mutation.output}:x);
    const v=assessArmNineQuestionQuality({...good,answers:changed});
    assert.equal(v.furtherArmLabEligible,false,mutation.id);
    assert.ok(v.semanticChecksPassed<9,mutation.id);
    assert.equal(v.publicReleaseApproved,false);
  }
});

test("duplicate, partial, wrong model, invalid memory and timeout evidence fail closed",()=>{
  const cases=[
    null,{}, {...good,arch:"x64"}, {...good,requestedThreads:4},
    {...good,measuredPeakRssBytes:null},
    {...good,measuredPeakRssBytes:7*1024**3},
    {...good,answers:correct.slice(1)},
    {...good,answers:[...correct.slice(0,8),correct[0]]},
    {...good,answers:correct.map((x,i)=>i===0?{...x,model:"bad"}:x)},
    {...good,answers:correct.map((x,i)=>i===0?{...x,finishReason:"length"}:x)},
    {...good,answers:correct.map((x,i)=>i===0?{...x,elapsedMs:60000}:x)},
  ];
  for(const evidence of cases){
    const v=assessArmNineQuestionQuality(evidence);
    assert.equal(v.furtherArmLabEligible,false);
    assert.equal(v.qualityApprovedForPublicChat,false);
  }
});

test("workflow uses pinned real native Arm64 model on free runner, not OCI credentials",()=>{
  const yaml=readFileSync(new URL("../.github/workflows/hercules-arm64-nine-quality.yml",import.meta.url),"utf8");
  for(const needle of [
    "runs-on: ubuntu-24.04-arm",
    "timeout-minutes: 20",
    "d81235049384534c167caea52b85a694f6103d14",
    "eadd1b868ae382c989d828189bdb8e5d34dc675c",
    "468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34",
    "--threads 2","--host 127.0.0.1",
    "BENCHMARK_CASES",
    "hercules-arm64-nine-quality.mjs --evaluate"
  ])assert.ok(yaml.includes(needle),"missing evidence control "+needle);
  assert.match(yaml,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(yaml,/OPENAI_API_KEY|HF_TOKEN|RENDER_API_KEY|oci\s+compute\s+instance\s+launch|supabase\.co\/functions\/v1/);
});
