import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  HERCULES_QWEN_CANDIDATE,
  QWEN_TEST_CASES,
  evaluateQwenHalfbDiagnostic,
  parseQwenHalfbDiagnostic,
} from "../scripts/hercules-qwen-halfb-cpu-diagnostic.mjs";

const good={
  cpuQuotaMicros:10000,cpuPeriodMicros:100000,memoryLimitBytes:536870912,
  processPeakRssBytes:360000000,cgroupMemoryPeakBytes:365000000,
  responses: [
    {id:"addition",elapsedMs:7000,reply:{model:"hercules-trial",choices:[{finish_reason:"stop",message:{role:"assistant",content:"4"}}]}},
    {id:"comparison",elapsedMs:7500,reply:{model:"hercules-trial",choices:[{finish_reason:"stop",message:{role:"assistant",content:"12"}}]}},
    {id:"capital",elapsedMs:8000,reply:{model:"hercules-trial",choices:[{finish_reason:"stop",message:{role:"assistant",content:"Paris"}}]}},
  ]
};
test("external candidate is checksum pinned, licensed and not company-owned",()=>{
  assert.equal(HERCULES_QWEN_CANDIDATE.model,"Qwen2.5-0.5B-Instruct-Q3_K_S.gguf");
  assert.equal(HERCULES_QWEN_CANDIDATE.source,"bartowski/Qwen2.5-0.5B-Instruct-GGUF");
  assert.equal(HERCULES_QWEN_CANDIDATE.revision,"eadd1b868ae382c989d828189bdb8e5d34dc675c");
  assert.equal(HERCULES_QWEN_CANDIDATE.sha256,"468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34");
  assert.equal(HERCULES_QWEN_CANDIDATE.license,"apache-2.0");
  assert.equal(QWEN_TEST_CASES.length,3);
});
test("successful real replies only qualify a further experiment",()=>{
 const r=evaluateQwenHalfbDiagnostic(good);
 assert.equal(r.budgetVerified,true);
 assert.equal(r.responsesValid,3);
 assert.equal(r.correctAnswers,3);
 assert.equal(r.qualityCandidateForFurtherLab,true);
 assert.equal(r.productionInferenceVerified,false);
 assert.equal(r.publicReleaseApproved,false);
 assert.equal(r.paidCommerceEnabled,false);
});
test("incorrect, incomplete, missing model, fake or duplicate answers fail closed",()=>{
 const bads=[
  {...good,responses:good.responses.map((x,i)=>i?x:{...x,reply:{model:"hercules-trial",choices:[{finish_reason:"stop",message:{role:"assistant",content:"2"}}]}})},
  {...good,responses:good.responses.map((x,i)=>i?x:{...x,reply:{model:"wrong",choices:x.reply.choices}})},
  {...good,responses:good.responses.map((x,i)=>i?x:{...x,reply:{model:"hercules-trial",choices:[{finish_reason:"length",message:{role:"assistant",content:"4"}}]}})},
  {...good,responses:good.responses.slice(0,2)},
  {...good,responses:[...good.responses,good.responses[0]]},
  {...good,responses:good.responses.map((x,i)=>i?x:{...x,reply:{model:"hercules-trial",choices:[{finish_reason:"stop",message:{role:"assistant",content:"4 but the answer is 2"}}]}})}
 ];
 for(const v of bads)assert.equal(evaluateQwenHalfbDiagnostic(v).qualityCandidateForFurtherLab,false);
});
test("insufficient memory headroom, inaccurate quota or slow response fail closed",()=>{
 for(const v of [
  {...good,cpuQuotaMicros:25000},
  {...good,memoryLimitBytes:1073741824},
  {...good,processPeakRssBytes:450000000},
  {...good,cgroupMemoryPeakBytes:460000000},
  {...good,responses:good.responses.map(x=>({...x,elapsedMs:25000}))},
 ]){
   const r=evaluateQwenHalfbDiagnostic(v);
   assert.equal(r.qualityCandidateForFurtherLab,false);
   assert.equal(r.publicReleaseApproved,false);
 }
});
test("strict structured evidence parser detects model response and rejects tampering",()=>{
 const payload=JSON.stringify(good.responses[0].reply);
 const make=(text)=>"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "+Buffer.byteLength(text)+"\r\n\r\n"+text;
 const records=[
  "HERCULES_CPU_QUOTA=10000","HERCULES_CPU_PERIOD=100000",
  "HERCULES_MEMORY_LIMIT=536870912","HERCULES_PROCESS_PEAK_RSS_BYTES=360000000",
  "HERCULES_MEMORY_PEAK=365000000",
  ...QWEN_TEST_CASES.flatMap(c=>{
   const id=c.id.toUpperCase();
   return ["HERCULES_CASE_"+id+"_MS=8000",
           "HERCULES_CASE_"+id+"_HTTP="+Buffer.from(make(payload)).toString("base64")];
  })
 ];
 const parsed=parseQwenHalfbDiagnostic(records.join("\n"));
 assert.equal(parsed.responses.length,3);
 assert.equal(parsed.responses[0].reply.model,"hercules-trial");
 assert.throws(()=>parseQwenHalfbDiagnostic([...records,records[0]].join("\n")),/duplicate/i);
 assert.throws(()=>parseQwenHalfbDiagnostic(records.join("\n").replace(/HERCULES_CPU_QUOTA=10000/,"HERCULES_CPU_QUOTA=bad")),/invalid/i);
});
test("workflow has exact checksum, runtime pin, read-only standard runner and no production deploy",()=>{
 const yaml=readFileSync(new URL("../.github/workflows/hercules-qwen-halfb-cpu-diagnostic.yml",import.meta.url),"utf8");
 for(const phrase of [
   "runs-on: ubuntu-24.04","timeout-minutes: 20",
   HERCULES_QWEN_CANDIDATE.revision,HERCULES_QWEN_CANDIDATE.sha256,
   "--cpus 0.10","--memory 512m","--memory-swap 512m","--network none",
   "--cap-drop ALL","--read-only","--pids-limit 64",
   "d81235049384534c167caea52b85a694f6103d14",
 ])assert.ok(yaml.includes(phrase),"missing "+phrase);
 assert.match(yaml,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(yaml,/OPENAI_API_KEY|HF_TOKEN|RENDER_API_KEY|railway\.app\/graphql|supabase\.co\/functions/);
});
