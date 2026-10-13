import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BENCHMARK_CASES} from "../scripts/hercules-360m-quality-benchmark.mjs";
import {evaluateConstrainedCpuEvidence, CONSTRAINTS} from "../scripts/hercules-360m-constrained-cpu.mjs";

const answerById={arithmetic:"4",capital:"Paris",instruction:"HELLO",subtraction:"4",
  multiplication:"15",comparison:"No",echo:"SKY",unknown:"I don't know.",private:"I don't know."};
const fixture=()=>({
 cpuMax:"15000 100000",memoryMaxBytes:536870912,memoryPeakBytes:455000000,
 oomKills:0,
 answers:BENCHMARK_CASES.map(item=>({id:item.id,output:answerById[item.id],elapsedMs:2500}))
});

test("enforces a real 0.15 vCPU cgroup and 512 MiB memory cap without claiming cloud parity",()=>{
 const result=evaluateConstrainedCpuEvidence(fixture());
 assert.equal(CONSTRAINTS.cpuQuota,15000);
 assert.equal(CONSTRAINTS.cpuPeriod,100000);
 assert.equal(CONSTRAINTS.memoryMaxBytes,536870912);
 assert.equal(result.cpuQuotaVerified,true);
 assert.equal(result.memoryLimitVerified,true);
 assert.equal(result.noOomKills,true);
 assert.equal(result.resourceTrialCompleted,true);
 assert.equal(result.runtimeMeasuredOnRealRender,false);
 assert.equal(result.publicReleaseApproved,false);
 assert.equal(result.productionConnected,false);
 assert.equal(result.p95MeasuredLatencyMs,2500);
 assert.equal(result.semanticChecksPassed,9);
});

test("malformed, unlimited, incorrect or contradictory quotas cannot count as constrained proof",()=>{
 for(const overrides of [
  {cpuMax:"max 100000"},{cpuMax:"20000 100000"},{cpuMax:"15000 10000"},
  {cpuMax:"not a quota"},{memoryMaxBytes:0},{memoryMaxBytes:1073741824},
  {memoryPeakBytes:537000000},{oomKills:1},{oomKills:-1},
 ]){
  const result=evaluateConstrainedCpuEvidence({...fixture(),...overrides});
  assert.equal(result.resourceTrialCompleted,false,JSON.stringify(overrides));
  assert.equal(result.publicReleaseApproved,false);
 }
});

test("failed/missing/duplicate or unmeasured prompts never count as complete",()=>{
 const baseline=fixture();
 for(const broken of [
  {...baseline,answers:baseline.answers.slice(1)},
  {...baseline,answers:[...baseline.answers,baseline.answers[0]]},
  {...baseline,answers:baseline.answers.map((r,i)=>i===0?{...r,output:""}:r)},
  {...baseline,answers:baseline.answers.map((r,i)=>i===0?{...r,elapsedMs:0}:r)},
  {...baseline,answers:baseline.answers.map((r,i)=>i===0?{...r,elapsedMs:120001}:r)},
 ]){
  assert.equal(evaluateConstrainedCpuEvidence(broken).resourceTrialCompleted,false);
 }
});

test("bad answers and privacy hallucination fail quality without erasing measured compute evidence",()=>{
 const evidence=fixture();
 evidence.answers=evidence.answers.map(x=>x.id==="private"?{...x,output:"The private password is ABC"}:x);
 const result=evaluateConstrainedCpuEvidence(evidence);
 assert.equal(result.resourceTrialCompleted,true);
 assert.equal(result.semanticChecksPassed,8);
 assert.equal(result.abstentionChecksPassed,1);
 assert.equal(result.qualityApprovedForPublicChat,false);
});

test("summary excludes raw prompts, outputs, tokens, provider keys and internal hostnames",()=>{
 const evidence=fixture();
 evidence.answers[0].output="PRIVATE-PROMPT-SECRET";
 evidence.privateInternalUrl="http://internal-model:18773";
 const result=evaluateConstrainedCpuEvidence(evidence);
 const serialized=JSON.stringify(result);
 assert.doesNotMatch(serialized,/PRIVATE-PROMPT-SECRET|internal-model/);
 assert.ok(result.rows.every(r=>!Object.hasOwn(r,"output")&&!Object.hasOwn(r,"prompt")));
});

test("p95 measured time cannot be advertised as an actual Render latency",()=>{
 const evidence=fixture();
 evidence.answers=evidence.answers.map((r,i)=>({...r,elapsedMs:(i+1)*1300}));
 const result=evaluateConstrainedCpuEvidence(evidence);
 assert.equal(result.p95MeasuredLatencyMs,11700);
 assert.equal(result.runtimeMeasuredOnRealRender,false);
 assert.equal(result.publicReleaseApproved,false);
});

test("workflow pins external binaries, verifies cgroup quotas and prevents public/provider side effects",()=>{
 const yaml=readFileSync(new URL("../.github/workflows/hercules-360m-constrained-cpu.yml",import.meta.url),"utf8");
 for(const phrase of [
  "ubuntu-24.04","timeout-minutes: 30",
  "d81235049384534c167caea52b85a694f6103d14",
  "2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2",
  "--cpus 0.15","--memory 512m","--memory-swap 512m",
  "--network host","--read-only","--cap-drop ALL",
  "15000 100000","536870912","memory.peak",
  "memory.events","127.0.0.1","--no-webui",
  "scripts/hercules-360m-constrained-cpu.mjs",
 ])assert.ok(yaml.includes(phrase),"missing limit or provenance control: "+phrase);
 assert.match(yaml,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(yaml,/OPENAI_API_KEY|HERCULES_VAULT_ASSISTANT_TOKEN|render\.com\/api|railway\.app\/graphql/);
});
