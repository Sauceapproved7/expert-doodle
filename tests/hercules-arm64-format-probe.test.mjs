import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {HELLO_PROBES,formatProbeMessages,assessHelloFormatProbe} from "../scripts/hercules-arm64-format-probe.mjs";

const response=(item)=>({id:item.id,model:"hercules-arm-trial",finishReason:"stop",elapsedMs:650,output:item.mode==="system"?"HELLO":"Hello! How can I assist you today?"});
const good={arch:"arm64",requestedThreads:2,measuredPeakRssBytes:414000000,answers:HELLO_PROBES.map(response)};

test("baseline retains original user-only question; alternate adds a system instruction",()=>{
  assert.equal(HELLO_PROBES.length,6);
  assert.equal(HELLO_PROBES.filter(x=>x.mode==="baseline").length,3);
  assert.equal(HELLO_PROBES.filter(x=>x.mode==="system").length,3);
  assert.deepEqual(formatProbeMessages("baseline"),[{role:"user",content:"Reply with exactly HELLO."}]);
  const system=formatProbeMessages("system");
  assert.deepEqual(system.map(x=>x.role),["system","user"]);
  assert.equal(system[1].content,"Reply with exactly HELLO.");
  assert.match(system[0].content,/HELLO/);
  assert.throws(()=>formatProbeMessages("developer"));
});

test("complete repeated evidence can flag a better prompt hypothesis, never an AI release",()=>{
  const verdict=assessHelloFormatProbe(good);
  assert.equal(verdict.schema,"hercules.model.arm64-hello-robustness.v1");
  assert.equal(verdict.completeRealModelEvidence,true);
  assert.equal(verdict.baselineExactPasses,0);
  assert.equal(verdict.systemExactPasses,3);
  assert.equal(verdict.systemFormatHypothesisForFurtherLab,true);
  assert.equal(verdict.furtherArmLabEligible,false);
  assert.equal(verdict.ociInstanceProvisioned,false);
  assert.equal(verdict.productionInferenceVerified,false);
  assert.equal(verdict.qualityApprovedForPublicChat,false);
  assert.equal(verdict.publicReleaseApproved,false);
  assert.equal(verdict.paidCommerceEnabled,false);
});

test("no improvement claim when baseline is already correct or system response is imperfect",()=>{
  const allExact={...good,answers:good.answers.map(x=>({...x,output:"HELLO"}))};
  assert.equal(assessHelloFormatProbe(allExact).systemFormatHypothesisForFurtherLab,false);
  for(const bad of ["HELLO.","hello"," HELLO","HELLO\n","HELLO!"]){
    const changed=good.answers.map(x=>x.id==="hello-system-2"?{...x,output:bad}:x);
    const result=assessHelloFormatProbe({...good,answers:changed});
    assert.equal(result.completeRealModelEvidence,true);
    assert.equal(result.systemExactPasses,2);
    assert.equal(result.systemFormatHypothesisForFurtherLab,false);
  }
});

test("malformed, fabricated, duplicated, incomplete or wrong-hardware evidence fails closed",()=>{
  const badCases=[
    null,{}, {...good,arch:"x64"}, {...good,requestedThreads:4},
    {...good,measuredPeakRssBytes:0}, {...good,measuredPeakRssBytes:7*1024**3},
    {...good,answers:good.answers.slice(1)},
    {...good,answers:[...good.answers.slice(0,5),good.answers[0]]},
    {...good,answers:good.answers.map((x,i)=>i===0?{...x,model:"other"}:x)},
    {...good,answers:good.answers.map((x,i)=>i===0?{...x,finishReason:"length"}:x)},
    {...good,answers:good.answers.map((x,i)=>i===0?{...x,elapsedMs:31000}:x)},
    {...good,answers:good.answers.map((x,i)=>i===0?{...x,output:""}:x)}
  ];
  for(const evidence of badCases){
    const result=assessHelloFormatProbe(evidence);
    assert.equal(result.completeRealModelEvidence,false);
    assert.equal(result.systemFormatHypothesisForFurtherLab,false);
    assert.equal(result.publicReleaseApproved,false);
  }
});

test("native ARM64 workflow runs independent real repeat probe without changing original nine-question gate",()=>{
  const yml=readFileSync(new URL("../.github/workflows/hercules-arm64-nine-quality.yml",import.meta.url),"utf8");
  for(const token of [
    "BENCHMARK_CASES","HELLO_PROBES","formatProbeMessages",
    "hello-probe-answers.json","hello-probe-evidence.json",
    "scripts/hercules-arm64-nine-quality.mjs --evaluate",
    "scripts/hercules-arm64-format-probe.mjs --evaluate",
    "--host 127.0.0.1","--threads 2"
  ])assert.ok(yml.includes(token),token);
  assert.doesNotMatch(yml,/oci\s+compute\s+instance\s+launch|RENDER_API_KEY|OPENAI_API_KEY/);
});
