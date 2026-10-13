// Hercules first-party Qwen 1.5B native ARM64 quality comparator. Lab-only.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {BENCHMARK_CASES,evaluate360mQuality} from "./hercules-360m-quality-benchmark.mjs";
import {SYSTEM_HOLDOUT_CASES,assessSystemQualityMatrix} from "./hercules-arm64-system-quality-matrix.mjs";

export const QWEN15_GGUF=Object.freeze({
  repo:"bartowski/Qwen2.5-1.5B-Instruct-GGUF",
  revision:"ec7a7a1a4d6ff0f562a01d41672912bacd9a56b3",
  file:"Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
  sha256:"1adf0b11065d8ad2e8123ea110d1ec956dab4ab038eab665614adba04b6c3370",
  license:"apache-2.0",
  upstream:"Qwen/Qwen2.5-1.5B-Instruct"
});
const ALIAS="hercules-15b-arm-trial";
const MAX_RSS_BYTES=12*1024**3;
const SYSTEM_CASES=Object.freeze([...BENCHMARK_CASES,...SYSTEM_HOLDOUT_CASES]);
const hasExactKeys=(rows,expected)=>Array.isArray(rows)&&rows.length===expected.length&&
  new Set(rows.map(r=>r?.id)).size===expected.length&&
  rows.every(row=>expected.includes(row?.id));
const rowValid=(row,validId)=>Boolean(
  row?.id===validId&&row.model===ALIAS&&row.finishReason==="stop"&&
  typeof row.output==="string"&&row.output.trim().length>0&&row.output.length<=4096&&
  Number.isSafeInteger(row.elapsedMs)&&row.elapsedMs>0&&row.elapsedMs<=30000
);
const exactRequired=Object.freeze({instruction:"HELLO",echo:"SKY"});
export function assessQwen15ArmComparison(evidence){
  const baseline=Array.isArray(evidence?.baselineAnswers)?evidence.baselineAnswers:[];
  const system=Array.isArray(evidence?.systemAnswers)?evidence.systemAnswers:[];
  const baselineIds=BENCHMARK_CASES.map(c=>c.id);
  const systemIds=SYSTEM_CASES.map(c=>"sys-"+c.id);
  const validBaseline=hasExactKeys(baseline,baselineIds)&&
    baseline.every(row=>rowValid(row,row.id));
  const validSystem=hasExactKeys(system,systemIds)&&
    system.every(row=>rowValid(row,row.id));
  const peak=evidence?.measuredPeakRssBytes;
  const validMemory=Number.isSafeInteger(peak)&&peak>0&&peak<MAX_RSS_BYTES;
  const validIdentity=evidence?.arch==="arm64"&&evidence.requestedThreads===2&&
    evidence.modelSha256===QWEN15_GGUF.sha256;
  const completeRealModelEvidence=Boolean(validIdentity&&validMemory&&
    validBaseline&&validSystem);
  const legacy=evaluate360mQuality({
    answers:baseline,
    peakRssKb:validMemory?Math.ceil(peak/1024):null
  },{ramLimitBytes:MAX_RSS_BYTES});
  // Explicitly validate 1.5B service alias and immutable file checksum above.
  // Then adapt ONLY the fixed case labels for reuse of existing scoring.
  const adapter=system.map(r=>({
    ...r,id:r.id.startsWith("sys-")?r.id.slice(4):r.id,model:"hercules-arm-trial"
  }));
  const systemScore=assessSystemQualityMatrix({
    arch:evidence?.arch,requestedThreads:evidence?.requestedThreads,
    measuredPeakRssBytes:peak,answers:adapter
  });
  const baselineExactFormatPasses=legacy.rows.filter(r=>{
    if(!r.formatPass)return false;
    const token=exactRequired[r.id];
    return !token||baseline.find(x=>x.id===r.id)?.output===token;
  }).length;
  const times=[...baseline,...system].map(r=>r?.elapsedMs)
    .filter(t=>Number.isSafeInteger(t)&&t>0).sort((a,b)=>a-b);
  const p95=completeRealModelEvidence?
    times[Math.ceil(.95*times.length)-1]:null;
  const hypothesis=Boolean(completeRealModelEvidence&&legacy.semanticChecksPassed===9&&
    baselineExactFormatPasses===9&&legacy.abstentionChecksPassed===2&&
    systemScore.systemPromptCandidateForFurtherLab&&
    systemScore.completeRealModelEvidence&&p95<=15000);
  return Object.freeze({
    schema:"hercules.model.arm64-qwen15-comparison.v1",
    modelFile:QWEN15_GGUF.file,modelAlias:ALIAS,
    externalModelLicense:QWEN15_GGUF.license,
    verifiedModelSha256:validIdentity?QWEN15_GGUF.sha256:null,
    completeRealModelEvidence,
    observedTotalRequests:baseline.length+system.length,
    peakProcessRssBytes:validMemory?peak:null,
    p95ObservedLatencyMs:p95,
    baseline:{
      total:9,semanticPasses:legacy.semanticChecksPassed,
      exactFormatPasses:baselineExactFormatPasses,
      abstentionsPassed:legacy.abstentionChecksPassed,
      rows:legacy.rows
    },
    system:{
      total:18,coreSemanticPasses:systemScore.coreSemanticPasses,
      coreFormatPasses:systemScore.coreFormatPasses,
      holdoutSemanticPasses:systemScore.holdoutSemanticPasses,
      holdoutExactPasses:systemScore.holdoutExactPasses,
      coreAbstentionsPassed:systemScore.coreAbstentionsPassed,
      holdoutAbstentionsPassed:systemScore.holdoutAbstentionsPassed,
      rows:systemScore.rows
    },
    experimentalCandidateForFurtherLab:hypothesis,
    // Deliberately independent of ephemeral runner and quality screen success.
    furtherArmLabEligible:false,
    githubArmRunnerNotOCI:true,ociInstanceProvisioned:false,
    ociFreeAllowanceVerifiedForAccount:false,
    productionInferenceVerified:false,qualityApprovedForPublicChat:false,
    publicReleaseApproved:false,paidCommerceEnabled:false,
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])
    throw new Error("fixed local test evidence required");
  try{
    const input=JSON.parse(readFileSync(process.argv[3],"utf8"));
    process.stdout.write(JSON.stringify(assessQwen15ArmComparison(input))+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      completeRealModelEvidence:false,experimentalCandidateForFurtherLab:false,
      furtherArmLabEligible:false,ociInstanceProvisioned:false,
      productionInferenceVerified:false,qualityApprovedForPublicChat:false,
      publicReleaseApproved:false,error:"qwen15_lab_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
