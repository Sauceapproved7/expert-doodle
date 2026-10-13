import test from "node:test";
import assert from "node:assert/strict";
import {BENCHMARK_CASES,evaluate360mQuality} from "../scripts/hercules-360m-quality-benchmark.mjs";

const fixture=(fn=({id})=>(
  {arithmetic:"2 + 2 = 4",capital:"The capital of France is Paris.",instruction:"Hello",
   subtraction:"4",multiplication:"15",comparison:"No",
   echo:"SKY",unknown:"I don't know.",private:"I don't know."}[id]
))=>({
  peakRssKb:360000,
  answers:BENCHMARK_CASES.map(item=>({id:item.id,output:fn(item),elapsedMs:475}))
});

test("benchmark has nine fixed synthetic non-customer prompts, including two abstentions",()=>{
 assert.equal(BENCHMARK_CASES.length,9);
 assert.equal(new Set(BENCHMARK_CASES.map(x=>x.id)).size,9);
 assert.equal(BENCHMARK_CASES.filter(x=>x.kind==="abstain").length,2);
 assert.ok(BENCHMARK_CASES.every(x=>typeof x.prompt==="string"&&x.prompt.length<=240));
});
test("real previously observed three answers count as semantically correct, but only one exact format",()=>{
 const data=fixture();
 const out=evaluate360mQuality(data);
 assert.equal(out.sampleChecksTotal,9);
 assert.equal(out.semanticChecksPassed,9);
 assert.equal(out.formatChecksPassed,7);
 assert.equal(out.measurementComplete,true);
 assert.equal(out.experimentalQualityCandidate,true);
 assert.equal(out.publicReleaseApproved,false);
 assert.equal(out.chatInferenceVerifiedForProduction,false);
 assert.equal(out.comparableToRenderFreeCpu,false);
});
test("correct fact embedded in conflicting answer never qualifies",()=>{
 const wrong=evaluate360mQuality(fixture(item=>item.id==="arithmetic"?"It could be 4 or 5":({
 arithmetic:"4",capital:"Paris",instruction:"HELLO",subtraction:"4",
 multiplication:"15",comparison:"No",echo:"SKY",
 unknown:"I don't know.",private:"I don't know."
 }[item.id])));
 assert.equal(wrong.semanticChecksPassed,8);
 assert.equal(wrong.experimentalQualityCandidate,false);
});
test("unanswerable or private fact requires explicit abstention",()=>{
 const answers=fixture(item=>item.id==="unknown"?"The mayor was Captain Orion":item.id==="private"?"The password is OPEN-SESAME":"4");
 const out=evaluate360mQuality(answers);
 assert.equal(out.abstentionChecksPassed,0);
 assert.equal(out.experimentalQualityCandidate,false);
});
test("missing and duplicate measurements are not quality passes",()=>{
 const good=fixture();
 for(const bad of [
 {...good,answers:good.answers.slice(1)},
 {...good,answers:[...good.answers,good.answers[0]]},
 {...good,answers:good.answers.map((a,i)=>i? a:{...a,output:""})},
 {...good,answers:good.answers.map((a,i)=>i? a:{...a,elapsedMs:0})},
 {...good,peakRssKb:null},
 {...good,peakRssKb:620000},
 ]){
   const out=evaluate360mQuality(bad);
   assert.equal(out.experimentalQualityCandidate,false);
   assert.equal(out.publicReleaseApproved,false);
 }
});
test("no model text, tokens or private prompts appear in evaluator output",()=>{
 const out=evaluate360mQuality(fixture(()=> "SENSITIVE-MODEL-TEXT"));
 assert.doesNotMatch(JSON.stringify(out),/SENSITIVE-MODEL-TEXT/);
 assert.ok(out.rows.every(x=>!Object.hasOwn(x,"output")&&!Object.hasOwn(x,"prompt")));
});
test("latency measured but never used to claim performance on 0.15 Render CPU",()=>{
 const out=evaluate360mQuality(fixture());
 assert.equal(out.p95ObservedLatencyMs,475);
 assert.equal(out.comparableToRenderFreeCpu,false);
 assert.equal(out.qualityApprovedForPublicChat,false);
});
