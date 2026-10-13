// First-party ARM64 Qwen expanded-system-instruction screening, strictly lab-only.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {BENCHMARK_CASES,evaluate360mQuality} from "./hercules-360m-quality-benchmark.mjs";

const MODEL="hercules-arm-trial";
const MAX_MEMORY=6*1024**3;
const SYSTEM_GUIDE="Follow the user's requested output format exactly. Return only the requested answer, with no greeting, explanation, extra punctuation, or leading/trailing whitespace unless explicitly requested. Preserve exact capitalization when asked. Never guess private credentials or unknowable future facts; use the unknown marker requested by the user.";

export const SYSTEM_HOLDOUT_CASES=Object.freeze([
  {id:"holdout-sum",kind:"number",prompt:"What is 16 plus 7? Answer with digits only.",expected:"23"},
  {id:"holdout-product",kind:"number",prompt:"What is 6 times 7? Answer with digits only.",expected:"42"},
  {id:"holdout-rome",kind:"capital",prompt:"What is the capital of Italy? Write the city only.",expected:"Rome"},
  {id:"holdout-comparison",kind:"yesno",prompt:"Is 8 greater than 13? Reply with exactly YES or NO.",expected:"NO"},
  {id:"holdout-river",kind:"token",prompt:"Reply with exactly RIVER.",expected:"RIVER"},
  {id:"holdout-zebra",kind:"token",prompt:"Reply with exactly ZEBRA.",expected:"ZEBRA"},
  {id:"holdout-ok",kind:"token",prompt:"Output exactly OK.",expected:"OK"},
  {id:"holdout-unknown",kind:"abstain",prompt:"Who will be mayor of the fictional Europa town Zephyr in 2098? If unknowable reply with exactly UNKNOWN.",expected:"UNKNOWN"},
  {id:"holdout-private",kind:"abstain",prompt:"What is a random stranger's private authentication PIN? If unknowable reply with exactly UNKNOWN.",expected:"UNKNOWN"}
].map(c=>Object.freeze(c)));

export function systemQualityMessages(prompt){
  if(typeof prompt!=="string"||!prompt.trim()||prompt.length>1024)
    throw new TypeError("bounded public fixed prompt required");
  return [
    {role:"system",content:SYSTEM_GUIDE},
    {role:"user",content:prompt}
  ];
}

const HOLDOUT_CHECKS=Object.freeze({
  number:/^(?:23|42)[.!]?\s*$/,
  capital:/^(?:the capital of italy is\s*)?rome[.!]?\s*$/i,
  yesno:/^no[.!]?\s*$/i,
  token:/^(?:RIVER|ZEBRA|OK)[.!]?\s*$/i,
  abstain:/^(?:unknown|i (?:don't|do not) know|i (?:cannot|can't) know)[.!]?\s*$/i
});

export function assessSystemQualityMatrix(evidence){
  const list=Array.isArray(evidence?.answers)?evidence.answers:[];
  const all=[...BENCHMARK_CASES,...SYSTEM_HOLDOUT_CASES];
  const ids=new Set(all.map(c=>c.id));
  const provided=new Set(list.map(row=>row?.id));
  const completeIds=list.length===all.length&&provided.size===all.length&&
    [...provided].every(id=>ids.has(id));
  const archVerified=evidence?.arch==="arm64"&&evidence.requestedThreads===2;
  const peak=evidence?.measuredPeakRssBytes;
  const memoryVerified=Number.isSafeInteger(peak)&&peak>0&&peak<MAX_MEMORY;
  const rows=all.map(c=>{
    const candidates=list.filter(x=>x?.id===c.id);
    const r=candidates.length===1?candidates[0]:null;
    const valid=Boolean(r?.model===MODEL&&r?.finishReason==="stop"&&
      typeof r?.output==="string"&&r.output.trim()&&r.output.length<=4096&&
      Number.isSafeInteger(r.elapsedMs)&&r.elapsedMs>0&&r.elapsedMs<=30000);
    let semantic=false;
    let exact=false;
    if(valid&&c.id.startsWith("holdout-")){
      semantic=HOLDOUT_CHECKS[c.kind].test(r.output.trim())&&
        (c.kind!=="number"||r.output.trim().replace(/[.!]$/,"")===c.expected)&&
        (c.kind!=="token"||r.output.trim().replace(/[.!]$/,"").toUpperCase()===c.expected);
      exact=r.output===c.expected;
    }
    return Object.freeze({id:c.id,group:c.id.startsWith("holdout-")?"holdout":"core",
      kind:c.kind,validResponse:valid,semanticPass:semantic,exactFormatPass:exact,
      elapsedMs:valid?r.elapsedMs:null});
  });
  const coreAnswers=BENCHMARK_CASES.map(c=>list.find(row=>row?.id===c.id)).filter(Boolean);
  const score=evaluate360mQuality({
    answers:coreAnswers,
    peakRssKb:memoryVerified?Math.ceil(peak/1024):null
  },{ramLimitBytes:MAX_MEMORY});
  const coreMap=new Map(score.rows.map(row=>[row.id,row]));
  // The inherited comparator tolerates punctuation/case; exact-token tasks
  // must NOT treat "Hello!" or "sky." as following "exactly HELLO/SKY".
  const exactCoreTokens=Object.freeze({instruction:"HELLO",echo:"SKY"});
  const reconciled=rows.map(r=>{
    if(r.group!=="core")return r;
    const scored=coreMap.get(r.id);
    const response=list.find(row=>row?.id===r.id);
    const strictToken=exactCoreTokens[r.id];
    return Object.freeze({...r,
      semanticPass:r.validResponse&&Boolean(scored?.semanticPass),
      exactFormatPass:r.validResponse&&Boolean(scored?.formatPass)&&
        (!strictToken||response?.output===strictToken)
    });
  });
  const coreExactPasses=reconciled.filter(r=>r.group==="core"&&r.exactFormatPass).length;
  const holdoutRows=reconciled.filter(r=>r.group==="holdout");
  const holdoutSemanticPasses=holdoutRows.filter(r=>r.semanticPass).length;
  const holdoutExactPasses=holdoutRows.filter(r=>r.exactFormatPass).length;
  const holdoutAbstentionsPassed=holdoutRows.filter(r=>r.kind==="abstain"&&r.semanticPass).length;
  const completeRealModelEvidence=Boolean(completeIds&&archVerified&&memoryVerified&&
    score.measurementComplete&&reconciled.every(r=>r.validResponse));
  const latencies=reconciled.map(r=>r.elapsedMs).filter(Number.isSafeInteger).sort((a,b)=>a-b);
  const p95=completeRealModelEvidence?latencies[Math.ceil(latencies.length*.95)-1]:null;
  const hypothesis=Boolean(completeRealModelEvidence&&score.semanticChecksPassed===9&&
    coreExactPasses===9&&score.abstentionChecksPassed===2&&
    holdoutSemanticPasses===9&&holdoutExactPasses===9&&holdoutAbstentionsPassed===2&&
    p95<=15000);
  return Object.freeze({
    schema:"hercules.model.arm64-system-quality-matrix.v1",
    model:MODEL,architectureVerified:archVerified,
    promptStrategy:"fixed-general-system-format-guidance",
    completeRealModelEvidence,validResponses:reconciled.filter(r=>r.validResponse).length,
    totalCases:18,coreSemanticPasses:score.semanticChecksPassed,
    coreFormatPasses:coreExactPasses,coreAbstentionsPassed:score.abstentionChecksPassed,
    holdoutSemanticPasses,holdoutExactPasses,holdoutAbstentionsPassed,
    peakProcessRssBytes:memoryVerified?peak:null,p95ObservedLatencyMs:p95,
    systemPromptCandidateForFurtherLab:hypothesis,
    furtherArmLabEligible:false,
    githubArmRunnerNotOCI:true,ociInstanceProvisioned:false,
    ociFreeAllowanceVerifiedForAccount:false,
    productionInferenceVerified:false,qualityApprovedForPublicChat:false,
    publicReleaseApproved:false,paidCommerceEnabled:false,
    rows:reconciled
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])
    throw new Error("fixed local evidence file required");
  try{
    const evidence=JSON.parse(readFileSync(process.argv[3],"utf8"));
    process.stdout.write(JSON.stringify(assessSystemQualityMatrix(evidence))+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      completeRealModelEvidence:false,systemPromptCandidateForFurtherLab:false,
      furtherArmLabEligible:false,ociInstanceProvisioned:false,
      productionInferenceVerified:false,qualityApprovedForPublicChat:false,
      publicReleaseApproved:false,error:"system_quality_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
