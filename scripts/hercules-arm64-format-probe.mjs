// Original first-party bounded HELLO format experiment; never a production approval.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const MODEL_ID="hercules-arm-trial";
const THREE=3;
const MAX_PROCESS_BYTES=6*1024**3;
const ORIGINAL_HELLO_PROMPT="Reply with exactly HELLO.";
const SYSTEM_INSTRUCTION="Output the exact uppercase text HELLO and nothing else. No punctuation, explanation, quotation marks, or whitespace.";

export const HELLO_PROBES=Object.freeze(
  ["baseline","system"].flatMap(mode=>
    Array.from({length:THREE},(_,i)=>Object.freeze({id:`hello-${mode}-${i+1}`,mode}))
  )
);

export function formatProbeMessages(mode){
  if(mode==="baseline")return [{role:"user",content:ORIGINAL_HELLO_PROMPT}];
  if(mode==="system")return [
    {role:"system",content:SYSTEM_INSTRUCTION},
    {role:"user",content:ORIGINAL_HELLO_PROMPT}
  ];
  throw new TypeError("unrecognized fixed format probe mode");
}

export function assessHelloFormatProbe(evidence){
  const list=Array.isArray(evidence?.answers)?evidence.answers:[];
  const ids=new Set(HELLO_PROBES.map(row=>row.id));
  const provided=new Set(list.map(row=>row?.id));
  const uniqueFixedCases=list.length===HELLO_PROBES.length &&
    provided.size===HELLO_PROBES.length &&
    [...provided].every(id=>ids.has(id));
  const archAndThreads=evidence?.arch==="arm64" && evidence.requestedThreads===2;
  const mem=evidence?.measuredPeakRssBytes;
  const processMemoryMeasured=Number.isSafeInteger(mem) && mem>0 && mem<MAX_PROCESS_BYTES;
  const rows=HELLO_PROBES.map(item=>{
    const matches=list.filter(row=>row?.id===item.id);
    const answer=matches.length===1?matches[0]:null;
    const valid=Boolean(
      answer?.model===MODEL_ID && answer?.finishReason==="stop" &&
      typeof answer?.output==="string" && answer.output.trim().length>0 &&
      answer.output.length<=4096 && Number.isSafeInteger(answer.elapsedMs) &&
      answer.elapsedMs>0 && answer.elapsedMs<=30000
    );
    return Object.freeze({
      id:item.id,mode:item.mode,validResponse:valid,
      exactFormatPass:valid && answer.output==="HELLO",
      elapsedMs:valid?answer.elapsedMs:null
    });
  });
  const completeRealModelEvidence=Boolean(
    uniqueFixedCases && archAndThreads && processMemoryMeasured &&
    rows.every(row=>row.validResponse)
  );
  const baselineExactPasses=rows.filter(row=>row.mode==="baseline"&&row.exactFormatPass).length;
  const systemExactPasses=rows.filter(row=>row.mode==="system"&&row.exactFormatPass).length;
  const latencies=rows.map(row=>row.elapsedMs).filter(Number.isSafeInteger).sort((a,b)=>a-b);
  const p95ObservedLatencyMs=completeRealModelEvidence?latencies[Math.ceil(latencies.length*.95)-1]:null;
  return Object.freeze({
    schema:"hercules.model.arm64-hello-robustness.v1",
    model:MODEL_ID,
    sourcePromptUnchanged:true,
    responseCount:rows.filter(row=>row.validResponse).length,
    completeRealModelEvidence,
    baselineExactPasses,
    systemExactPasses,
    trialsPerMode:THREE,
    peakProcessRssBytes:processMemoryMeasured?mem:null,
    p95ObservedLatencyMs,
    systemFormatHypothesisForFurtherLab:completeRealModelEvidence &&
      systemExactPasses===THREE && systemExactPasses>baselineExactPasses,
    // This optional experiment NEVER revises the original nine-question gate.
    furtherArmLabEligible:false,
    ociInstanceProvisioned:false,
    ociFreeAllowanceVerifiedForAccount:false,
    productionInferenceVerified:false,
    qualityApprovedForPublicChat:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
    rows
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])
    throw new Error("fixed local evidence file required");
  try{
    const evidence=JSON.parse(readFileSync(process.argv[3],"utf8"));
    process.stdout.write(JSON.stringify(assessHelloFormatProbe(evidence))+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      completeRealModelEvidence:false,systemFormatHypothesisForFurtherLab:false,
      furtherArmLabEligible:false,ociInstanceProvisioned:false,
      productionInferenceVerified:false,qualityApprovedForPublicChat:false,
      publicReleaseApproved:false,error:"format_probe_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
