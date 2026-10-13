import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluateMathPromptDiagnostic, MATH_PROMPT_CASES} from "../scripts/hercules-math-prompt-diagnostic.mjs";

const valid={
  cpuQuotaMicros:10000,cpuPeriodMicros:100000,memoryLimitBytes:536870912,
  processPeakRssBytes:368123904,
  responses:MATH_PROMPT_CASES.flatMap(testCase=>
    ["baseline","system"].map(mode=>({
      id:testCase.id,mode,elapsedMs:10000,
      reply:{model:"hercules-trial",choices:[{
        finish_reason:"stop",message:{role:"assistant",content:testCase.expected}
      }]}
    }))
  )
};

test("six independent math/model replies, no model-release authority",()=>{
  assert.equal(MATH_PROMPT_CASES.length,3);
  assert.deepEqual(MATH_PROMPT_CASES.map(x=>x.expected),["4","12","2"]);
  const result=evaluateMathPromptDiagnostic(valid);
  assert.equal(result.baseline.correct,3);
  assert.equal(result.system.correct,3);
  assert.equal(result.completedTrials,6);
  assert.equal(result.diagnosticComplete,true);
  assert.equal(result.productionQualified,false);
  assert.equal(result.publicReleaseApproved,false);
  assert.equal(result.paidCommerceEnabled,false);
});

test("wrong answers are not made correct by HTTP completion",()=>{
  const altered={...valid,responses:valid.responses.map(x=>x.id==="addition"&&x.mode==="system" ?
     {...x,reply:{...x.reply,choices:[{finish_reason:"stop",message:{role:"assistant",content:"2"}}]}}:x)};
  const out=evaluateMathPromptDiagnostic(altered);
  assert.equal(out.system.correct,2);
  assert.equal(out.system.wrong,1);
  assert.equal(out.allQuestionsCorrect,false);
  assert.equal(out.productionQualified,false);
});

test("incomplete, missing, duplicated and wrong-model evidence fails closed",()=>{
  for(const responses of [
    [],valid.responses.slice(0,-1),[...valid.responses,valid.responses[0]],
    valid.responses.map((x,i)=>i===2?{...x,reply:{model:"other",choices:x.reply.choices}}:x),
    valid.responses.map((x,i)=>i===2?{...x,reply:{model:"hercules-trial",choices:[{finish_reason:"length",message:{role:"assistant",content:"12"}}]}}:x),
  ]) {
    const out=evaluateMathPromptDiagnostic({...valid,responses});
    assert.equal(out.diagnosticComplete,false);
    assert.equal(out.productionQualified,false);
  }
});

test("reported CPU quotas and memory must be actually measured",()=>{
  for(const bad of [
    {...valid,cpuQuotaMicros:20000},
    {...valid,memoryLimitBytes:1073741824},
    {...valid,processPeakRssBytes:0},
  ]){
    const out=evaluateMathPromptDiagnostic(bad);
    assert.equal(out.diagnosticComplete,false);
    assert.equal(out.productionQualified,false);
  }
});

test("no-network workflow must use pinned model, readonly container, and bounded runtime",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/hercules-math-prompt-diagnostic.yml",import.meta.url),"utf8");
  for(const marker of [
    "runs-on: ubuntu-24.04","timeout-minutes: 20",
    "--network none","--cpus 0.10","--memory 512m","--memory-swap 512m",
    "--read-only","--cap-drop ALL",
    "d81235049384534c167caea52b85a694f6103d14",
    "2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2",
    "270590880",
    "hercules-math-prompt-diagnostic.mjs"
  ])assert.ok(workflow.includes(marker),marker);
  assert.match(workflow,/permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow,/HF_TOKEN|RENDER_API_KEY|OPENAI_API_KEY|railway\.app\/graphql|supabase\.co\/functions/);
});


test("DA-45: mathematical correctness is independent of exact numeral formatting",()=>{
  const sentences=valid.responses.map(row=>({...row,
    reply:{model:"hercules-trial",choices:[{finish_reason:"stop",
      message:{role:"assistant",content:row.id==="addition"?"2 + 2 = 4":
        row.id==="compare"?"12":"5 minus 3 equals 2."}
    }]}
  }));
  const verdict=evaluateMathPromptDiagnostic({...valid,responses:sentences});
  assert.equal(verdict.diagnosticComplete,true);
  assert.equal(verdict.baseline.correct,3);
  assert.equal(verdict.system.correct,3);
  assert.equal(verdict.baseline.formatCorrect,1);
  assert.equal(verdict.system.formatCorrect,1);
  assert.equal(verdict.allQuestionsCorrect,true);
  assert.equal(verdict.publicReleaseApproved,false);
});

test("DA-45: a correct partial expression plus a wrong conclusion never counts",()=>{
  const wrong=valid.responses.map(row=>row.id==="subtraction"&&row.mode==="baseline"?
    {...row,reply:{model:"hercules-trial",choices:[{finish_reason:"stop",message:{
      role:"assistant",content:"5 minus 3 equals 2, but my answer is 8"
    }}]}}:row);
  const verdict=evaluateMathPromptDiagnostic({...valid,responses:wrong});
  assert.equal(verdict.baseline.correct,2);
  assert.equal(verdict.allQuestionsCorrect,false);
});
