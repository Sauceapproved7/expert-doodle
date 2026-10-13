import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessColdLoad, QWEN_COLD_LIMITS} from "../scripts/hercules-qwen-cold-load.mjs";

const correct={
  exitCode:0,oomKilled:false,coldCopyCompleted:true,
  cpuQuotaMicros:10000,cpuPeriodMicros:100000,
  chargedModelBytes:338000000,
  memoryLimitBytes:536870912,peakMemoryBytes:376000000,
  elapsedMs:7500,reply:{model:"hercules-trial",choices:[{
    finish_reason:"stop",message:{role:"assistant",content:"4"}
  }]}
};

test("do not treat a missing, failed or OOM-killed cold model as memory-qualified",()=>{
  for(const observed of [
    null, {}, {...correct,exitCode:137,oomKilled:true},
    {...correct,exitCode:1,oomKilled:false},
    {...correct,cpuQuotaMicros:50000},
    {...correct,coldCopyCompleted:false},
    {...correct,chargedModelBytes:null},
    {...correct,chargedModelBytes:10000000},
    {...correct,memoryLimitBytes:1073741824},
    {...correct,peakMemoryBytes:480000000},
    {...correct,reply:{model:"hercules-trial",choices:[{finish_reason:"stop",message:{role:"assistant",content:"2"}}]}},
    {...correct,reply:null}
  ]){
    const r=assessColdLoad(observed);
    assert.equal(r.eligibleForMoreLab,false);
    assert.equal(r.productionInferenceVerified,false);
    assert.equal(r.publicReleaseApproved,false);
  }
});

test("legitimate cold cgroup memory and correct answer only qualify further research",()=>{
  const r=assessColdLoad(correct);
  assert.equal(r.eligibleForMoreLab,true);
  assert.equal(r.memoryHeadroomOk,true);
  assert.equal(r.quotaVerified,true);
  assert.equal(r.correctAnswer,true);
  assert.equal(r.coldCopyVerified,true);
  assert.equal(r.productionInferenceVerified,false);
  assert.equal(r.customerChatApproved,false);
  assert.equal(r.paidCommerceEnabled,false);
});

test("OOM is distinguishable from normal completed experiment without implying success",()=>{
  const r=assessColdLoad({...correct,exitCode:137,oomKilled:true,coldCopyCompleted:false,reply:null});
  assert.equal(r.outcome,"oom");
  assert.equal(r.eligibleForMoreLab,false);
});

test("cold-load workflow forces external model file into no-network charged tmpfs",()=>{
  const y=readFileSync(new URL("../.github/workflows/hercules-qwen-cold-load.yml",import.meta.url),"utf8");
  for(const s of [
    "runs-on: ubuntu-24.04","timeout-minutes: 20",
    "--cpus 0.10","--memory 512m","--memory-swap 512m",
    "--network none","--read-only","--cap-drop ALL",
    "--tmpfs /cold-model:",
    "cp /candidate.gguf /cold-model/candidate.gguf",
    "cat /sys/fs/cgroup/memory.current",
    "cat /sys/fs/cgroup/memory.peak",
    "Qwen2.5-0.5B-Instruct-Q3_K_S.gguf",
    "468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34"
  ])assert.ok(y.includes(s),"missing "+s);
  assert.match(y,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(y,/HF_TOKEN|OPENAI_API_KEY|RENDER_API_KEY|railway\.app\/graphql|supabase\.co\/functions/);
});
