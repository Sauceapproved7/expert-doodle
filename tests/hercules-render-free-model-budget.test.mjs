import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  evaluateFreeModelBudget,
  parseFreeModelBudgetLog,
  RENDER_FREE_LIMITS,
} from "../scripts/hercules-render-free-model-budget.mjs";

const good={
  cpuQuotaMicros:10000,
  cpuPeriodMicros:100000,
  memoryLimitBytes:536870912,
  peakMemoryBytes:355000000,
  elapsedMs:9000,
  modelReply:{model:"hercules-trial",choices:[{message:{role:"assistant",content:"The answer is 4."},finish_reason:"stop"}]},
};

test("Render's actual Free web service budget is 0.1 CPU and 512 MiB RAM",()=>{
  assert.equal(RENDER_FREE_LIMITS.cpuFraction,0.1);
  assert.equal(RENDER_FREE_LIMITS.memoryBytes,536870912);
  assert.equal(RENDER_FREE_LIMITS.memoryHeadroomBytes,128*1024*1024);
});

test("a measured controlled run can qualify only for a further lab, not production",()=>{
  const value=evaluateFreeModelBudget(good);
  assert.equal(value.quotaVerified,true);
  assert.equal(value.measuredRealText,true);
  assert.equal(value.memoryWithinLimit,true);
  assert.equal(value.memoryHeadroomOk,true);
  assert.equal(value.responseUnder15s,true);
  assert.equal(value.furtherLabEligible,true);
  assert.equal(value.customerChatApproved,false);
  assert.equal(value.publicReleaseApproved,false);
  assert.equal(value.paidCommerceEnabled,false);
  assert.equal(value.productionInferenceVerified,false);
});

test("budget violation and absent proof always fail closed",()=>{
  for(const item of [
    null,{},{...good,cpuQuotaMicros:25000},{...good,memoryLimitBytes:1073741824},
    {...good,peakMemoryBytes:500000000},{...good,elapsedMs:18000},
    {...good,elapsedMs:null},{...good,modelReply:null},
    {...good,modelReply:{model:"wrong",choices:[{finish_reason:"stop",message:{role:"assistant",content:"4"}}]}},
  ]){
    assert.equal(evaluateFreeModelBudget(item).furtherLabEligible,false);
    assert.equal(evaluateFreeModelBudget(item).productionInferenceVerified,false);
  }
});

test("log parsing requires exact cgroup observations, no duplicate fields",()=>{
  const raw=[
    "HERCULES_CPU_QUOTA=10000",
    "HERCULES_CPU_PERIOD=100000",
    "HERCULES_MEMORY_LIMIT=536870912",
    "HERCULES_MEMORY_PEAK=355000000",
    "HERCULES_ELAPSED_MS=9000",
    "HERCULES_MODEL_REPLY_BASE64="+Buffer.from(
      ["HTTP/1.1 200 OK","Content-Type: application/json","Connection: close","",""].join(String.fromCharCode(13,10))
        +JSON.stringify(good.modelReply)
    ).toString("base64"),
  ].join("\n");
  assert.equal(parseFreeModelBudgetLog(raw).modelReply.model,"hercules-trial");
  assert.throws(()=>parseFreeModelBudgetLog(raw+"\nHERCULES_CPU_QUOTA=10000"),/duplicate/);
  assert.throws(()=>parseFreeModelBudgetLog(raw.replace("HERCULES_MEMORY_PEAK=355000000","HERCULES_MEMORY_PEAK=not-number")),/invalid/);
});


test("a startup banner or wrong model can never prove actual inference",()=>{
  assert.equal(evaluateFreeModelBudget({...good,modelReply:{text:"Loading model... \\nASCII"}}).furtherLabEligible,false);
  assert.equal(evaluateFreeModelBudget({...good,modelReply:{model:"hercules-trial",choices:[]}}).furtherLabEligible,false);
});

test("workflow enforces Docker CPU quota, 512MiB memory, no network and time limit",()=>{
  const yaml=readFileSync(new URL("../.github/workflows/hercules-render-free-model-budget.yml",import.meta.url),"utf8");
  for(const term of [
    "runs-on: ubuntu-24.04",
    "timeout-minutes: 20",
    "--cpus 0.10",
    "--memory 512m",
    "--memory-swap 512m",
    "--network none",
    "--read-only",
    "--cap-drop ALL",
    "--pids-limit 64",
    "d81235049384534c167caea52b85a694f6103d14",
    "2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2",
    "270590880"
  ]) assert.ok(yaml.includes(term),"missing isolation guard "+term);
  assert.match(yaml,/permissions:\s*\n\s*contents: read/);
  assert.match(yaml,/POST \/v1\/chat\/completions/);
  assert.match(yaml,/HERCULES_MODEL_REPLY_BASE64/);
  assert.doesNotMatch(yaml,/llama-cli|HERCULES_GENERATED_BASE64/);
  assert.doesNotMatch(yaml,/OPENAI_API_KEY|HF_TOKEN|RENDER_API_KEY|railway\.app\/graphql|supabase\.co\/functions/);
});
