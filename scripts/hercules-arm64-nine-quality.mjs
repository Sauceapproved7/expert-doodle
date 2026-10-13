// First-party Hercules native ARM64 Qwen quality evidence: a laboratory, never a release.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {BENCHMARK_CASES,evaluate360mQuality} from "./hercules-360m-quality-benchmark.mjs";
import {HERCULES_ARM_LAB_MODEL} from "./hercules-arm64-inference-lab.mjs";

const MODEL_ID="hercules-arm-trial";
const MAX_PEAK_BYTES=6*1024*1024*1024;

export function assessArmNineQuestionQuality(evidence){
  const list=Array.isArray(evidence?.answers)?evidence.answers:[];
  const architectureVerified=evidence?.arch==="arm64" && evidence.requestedThreads===2;
  const memory=evidence?.measuredPeakRssBytes;
  const processMemoryMeasured=Number.isSafeInteger(memory) && memory>0 && memory<MAX_PEAK_BYTES;
  const exactCaseIds=new Set(BENCHMARK_CASES.map(c=>c.id));
  const caseIds=new Set(list.map(row=>row?.id));
  const nineUnique= list.length===BENCHMARK_CASES.length &&
    caseIds.size===BENCHMARK_CASES.length &&
    [...caseIds].every(id=>exactCaseIds.has(id));
  const results=BENCHMARK_CASES.map(test=>{
    const rows=list.filter(row=>row?.id===test.id);
    const row=rows.length===1?rows[0]:null;
    const responseValid=Boolean(
      row?.model===MODEL_ID && row?.finishReason==="stop" &&
      typeof row?.output==="string" &&
      row.output.trim().length>0 && row.output.length<=4096 &&
      Number.isSafeInteger(row.elapsedMs) && row.elapsedMs>0 && row.elapsedMs<=30000
    );
    return {id:test.id,valid:responseValid};
  });
  const validResponses=results.filter(r=>r.valid).length;
  // Reuse the identical nine fixed synthetic questions / semantic scoring used
  // in the SmolLM2 benchmark so results are directly comparable by question.
  const score=evaluate360mQuality({
    answers:list,
    peakRssKb:processMemoryMeasured?Math.ceil(memory/1024):null
  },{ramLimitBytes:MAX_PEAK_BYTES});
  const completeRealModelEvidence=Boolean(
    architectureVerified && processMemoryMeasured && nineUnique &&
    validResponses===BENCHMARK_CASES.length &&
    score.measurementComplete
  );
  const withinLabLatency=Number.isFinite(score.p95ObservedLatencyMs) &&
    score.p95ObservedLatencyMs<=15000;
  const abstained=score.abstentionChecksPassed===2;
  const furtherArmLabEligible=Boolean(
    completeRealModelEvidence && score.semanticChecksPassed===BENCHMARK_CASES.length &&
    abstained && withinLabLatency
  );
  return Object.freeze({
    schema:"hercules.model.arm64-nine-question.v1",
    architecture:"arm64",
    model:HERCULES_ARM_LAB_MODEL.file,
    externalModelLicense:HERCULES_ARM_LAB_MODEL.license,
    requestedThreadsVerified:architectureVerified,
    sampleChecksTotal:BENCHMARK_CASES.length,
    validResponses,
    semanticChecksPassed:score.semanticChecksPassed,
    formatChecksPassed:score.formatChecksPassed,
    abstentionChecksPassed:score.abstentionChecksPassed,
    completeRealModelEvidence,
    peakProcessRssBytes:processMemoryMeasured?memory:null,
    p95ObservedLatencyMs:score.p95ObservedLatencyMs,
    furtherArmLabEligible,
    comparableToRenderFreeCpu:false,
    githubArmRunnerNotOCI:true,
    ociInstanceProvisioned:false,
    ociFreeAllowanceVerifiedForAccount:false,
    productionInferenceVerified:false,
    qualityApprovedForPublicChat:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
    rows:score.rows.map(r=>({...r,validResponse:results.find(x=>x.id===r.id)?.valid??false}))
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])
    throw new Error("fixed local evidence file required");
  try{
    const evidence=JSON.parse(readFileSync(process.argv[3],"utf8"));
    process.stdout.write(JSON.stringify(assessArmNineQuestionQuality(evidence))+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      completeRealModelEvidence:false,furtherArmLabEligible:false,
      ociInstanceProvisioned:false,qualityApprovedForPublicChat:false,
      publicReleaseApproved:false,error:"arm_quality_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
