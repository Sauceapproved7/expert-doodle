import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  HERCULES_ARM_LAB_MODEL,
  assessArmInferenceLab,
} from "../scripts/hercules-arm64-inference-lab.mjs";

const valid={
  arch:"arm64",
  requestedThreads:2,
  measuredPeakRssBytes:720000000,
  answers:[
    {id:"addition",elapsedMs:2500,model:"hercules-arm-trial",finishReason:"stop",output:"4"},
    {id:"comparison",elapsedMs:2100,model:"hercules-arm-trial",finishReason:"stop",output:"12"},
    {id:"capital",elapsedMs:2300,model:"hercules-arm-trial",finishReason:"stop",output:"Paris"}
  ]
};

test("exact licensed Qwen model provenance is immutable and not Hercules-owned",()=>{
  assert.equal(HERCULES_ARM_LAB_MODEL.source,"bartowski/Qwen2.5-0.5B-Instruct-GGUF");
  assert.equal(HERCULES_ARM_LAB_MODEL.revision,"eadd1b868ae382c989d828189bdb8e5d34dc675c");
  assert.equal(HERCULES_ARM_LAB_MODEL.sha256,"468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34");
  assert.equal(HERCULES_ARM_LAB_MODEL.license,"apache-2.0");
  assert.equal(HERCULES_ARM_LAB_MODEL.weightsOwnedBySauceApproved,false);
});

test("a correct real ARM64 observation grants lab evidence only, not OCI or public AI",()=>{
  const e=assessArmInferenceLab(valid);
  assert.equal(e.armArchitectureVerified,true);
  assert.equal(e.modelResponsesValid,3);
  assert.equal(e.correctAnswers,3);
  assert.equal(e.armLabEligible,true);
  assert.equal(e.ociInstanceProvisioned,false);
  assert.equal(e.ociFreeAllowanceVerifiedForAccount,false);
  assert.equal(e.productionInferenceVerified,false);
  assert.equal(e.publicReleaseApproved,false);
  assert.equal(e.paidCommerceEnabled,false);
});

test("missing, wrong, or slow responses fail closed",()=>{
  const cases=[
    null,{},
    {...valid,arch:"x64"},
    {...valid,requestedThreads:4},
    {...valid,measuredPeakRssBytes:8000000000},
    {...valid,answers:[]},
    {...valid,answers:[...valid.answers,valid.answers[0]]},
    {...valid,answers:valid.answers.map((v,i)=>i? v : {...v,output:"2"})},
    {...valid,answers:valid.answers.map((v,i)=>i? v : {...v,finishReason:"length"})},
    {...valid,answers:valid.answers.map((v,i)=>i? v : {...v,model:"wrong"})},
    {...valid,answers:valid.answers.map((v,i)=>i? v : {...v,elapsedMs:19000})}
  ];
  for(const input of cases) assert.equal(assessArmInferenceLab(input).armLabEligible,false);
});

test("the workflow uses native public Arm64 runner with pinned external assets and no deployment",()=>{
  const yaml=readFileSync(new URL("../.github/workflows/hercules-arm64-inference-lab.yml",import.meta.url),"utf8");
  for(const t of [
    "runs-on: ubuntu-24.04-arm",
    "timeout-minutes: 20",
    "d81235049384534c167caea52b85a694f6103d14",
    HERCULES_ARM_LAB_MODEL.revision,
    HERCULES_ARM_LAB_MODEL.sha256,
    "--threads 2",
    "--host 127.0.0.1"
  ])assert.ok(yaml.includes(t),"missing ARM laboratory guard: "+t);
  assert.match(yaml,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(yaml,/OPENAI_API_KEY|HF_TOKEN|RENDER_API_KEY|railway\.app|supabase\.co|oci\s+compute\s+instance\s+launch/);
});
