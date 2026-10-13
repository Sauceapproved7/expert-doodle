// Original Hercules evaluation of an externally licensed, ephemeral CPU model.
// One lab observation is not a customer-ready chat model or launch authority.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {parseFreeModelBudgetLog,RENDER_FREE_LIMITS} from "./hercules-render-free-model-budget.mjs";

export const HERCULES_QWEN_CANDIDATE=Object.freeze({
  source:"bartowski/Qwen2.5-0.5B-Instruct-GGUF",
  model:"Qwen2.5-0.5B-Instruct-Q3_K_S.gguf",
  revision:"eadd1b868ae382c989d828189bdb8e5d34dc675c",
  sha256:"468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34",
  license:"apache-2.0",
  weightsOwnedBySauceApproved:false,
});
export const QWEN_TEST_CASES=Object.freeze([
  Object.freeze({id:"addition",expected:"4"}),
  Object.freeze({id:"comparison",expected:"12"}),
  Object.freeze({id:"capital",expected:"paris"}),
]);
function correct(id,response){
 if(typeof response!=="string" || response.length>512)return false;
 const normalized=response.trim().toLowerCase().replace(/[.!?]+$/,"").trim();
 if(id==="addition")return normalized==="4"||
   normalized==="the answer is 4"||/^2\s*\+\s*2\s*=\s*4$/.test(normalized);
 if(id==="comparison")return normalized==="12"||
   normalized==="12 is larger"||normalized==="the answer is 12";
 if(id==="capital")return normalized==="paris"||
   normalized==="the capital of france is paris";
 return false;
}
export function evaluateQwenHalfbDiagnostic(evidence){
 const quota=evidence?.cpuQuotaMicros,period=evidence?.cpuPeriodMicros;
 const ram=evidence?.memoryLimitBytes;
 const proc=evidence?.processPeakRssBytes,peak=evidence?.cgroupMemoryPeakBytes;
 const budgetVerified=Number.isSafeInteger(quota)&&
   Number.isSafeInteger(period)&&period>0&&quota>0&&
   quota/period===RENDER_FREE_LIMITS.cpuFraction&&
   ram===RENDER_FREE_LIMITS.memoryBytes;
 const memMeasured=Number.isSafeInteger(proc)&&proc>0&&
   Number.isSafeInteger(peak)&&peak>0;
 const conservativePeak=memMeasured?Math.max(proc,peak):null;
 const memoryWithinLimit=memMeasured&&conservativePeak<=RENDER_FREE_LIMITS.memoryBytes;
 const headroom=memMeasured&&(RENDER_FREE_LIMITS.memoryBytes-conservativePeak)>=
   RENDER_FREE_LIMITS.memoryHeadroomBytes;
 const samples=Array.isArray(evidence?.responses)?evidence.responses:[];
 const unique=new Set(samples.map(x=>x?.id));
 const complete=unique.size===QWEN_TEST_CASES.length&&
   samples.length===QWEN_TEST_CASES.length &&
   QWEN_TEST_CASES.every(c=>samples.filter(x=>x?.id===c.id).length===1);
 const rows=QWEN_TEST_CASES.map(c=>{
  const x=samples.find(x=>x?.id===c.id);
  const choice=x?.reply?.choices?.[0];
  const valid=Boolean(x?.reply?.model==="hercules-trial" &&
    Array.isArray(x.reply.choices)&&x.reply.choices.length===1 &&
    choice?.finish_reason==="stop"&&choice?.message?.role==="assistant"&&
    typeof choice?.message?.content==="string"&&
    choice.message.content.trim()&&choice.message.content.length<=512&&
    Number.isSafeInteger(x.elapsedMs)&&x.elapsedMs>0&&x.elapsedMs<=150000);
  const answer=valid?choice.message.content:null;
  return Object.freeze({
    id:c.id,valid,correct:Boolean(valid&&correct(c.id,answer)),
    within15Seconds:Boolean(valid&&x.elapsedMs<=15000),
    elapsedMs:valid?x.elapsedMs:null,
    observedText:valid?answer.trim().slice(0,120):null,
  });
 });
 const responsesValid=rows.filter(x=>x.valid).length;
 const correctAnswers=rows.filter(x=>x.correct).length;
 const allFast=rows.every(x=>x.within15Seconds);
 return Object.freeze({
  schema:"hercules.model.qwen-halfb-cpu-diagnostic.v1",
  candidate:HERCULES_QWEN_CANDIDATE.model,
  budgetVerified:Boolean(budgetVerified),
  memoryWithinLimit:Boolean(memoryWithinLimit),
  memoryHeadroomOk:Boolean(headroom),
  processPeakRssBytes:memMeasured?proc:null,
  cgroupPeakBytes:memMeasured?peak:null,
  conservativePeakBytes:conservativePeak,
  responsesValid,correctAnswers,
  rows,
  qualityCandidateForFurtherLab:Boolean(budgetVerified&&memoryWithinLimit&&
    headroom&&complete&&responsesValid===3&&correctAnswers===3&&allFast),
  simulatedOnGitHubNotRender:true,
  productionInferenceVerified:false,
  publicReleaseApproved:false,
  paidCommerceEnabled:false,
 });
}
export function parseQwenHalfbDiagnostic(source){
 if(typeof source!=="string"||source.length>90000)throw new TypeError("invalid bounded evidence");
 const entries=new Map();
 for(const line of source.split(/\r?\n/)){
  if(!line.startsWith("HERCULES_"))continue;
  const m=/^(HERCULES_[A-Z0-9_]+)=(.*)$/.exec(line);
  if(!m||entries.has(m[1]))throw new TypeError("duplicate or invalid evidence field");
  entries.set(m[1],m[2]);
 }
 function n(key){
  const v=entries.get(key);
  if(!v||!/^[0-9]+$/.test(v))throw new TypeError("invalid or missing measured value");
  const value=Number(v);
  if(!Number.isSafeInteger(value))throw new TypeError("invalid numeric evidence");
  return value;
 }
 const cpuQuotaMicros=n("HERCULES_CPU_QUOTA");
 const cpuPeriodMicros=n("HERCULES_CPU_PERIOD");
 const memoryLimitBytes=n("HERCULES_MEMORY_LIMIT");
 const processPeakRssBytes=n("HERCULES_PROCESS_PEAK_RSS_BYTES");
 const cgroupMemoryPeakBytes=n("HERCULES_MEMORY_PEAK");
 const responses=QWEN_TEST_CASES.map(c=>{
  const prefix="HERCULES_CASE_"+c.id.toUpperCase();
  const elapsedMs=n(prefix+"_MS");
  const base64=entries.get(prefix+"_HTTP");
  if(!base64||base64.length>25000)throw new TypeError("missing model reply");
  const row=[
   "HERCULES_CPU_QUOTA="+cpuQuotaMicros,
   "HERCULES_CPU_PERIOD="+cpuPeriodMicros,
   "HERCULES_MEMORY_LIMIT="+memoryLimitBytes,
   "HERCULES_MEMORY_PEAK="+cgroupMemoryPeakBytes,
   "HERCULES_PROCESS_PEAK_RSS_BYTES="+processPeakRssBytes,
   "HERCULES_ELAPSED_MS="+elapsedMs,
   "HERCULES_MODEL_REPLY_BASE64="+base64
  ].join("\n");
  const decoded=parseFreeModelBudgetLog(row);
  return {id:c.id,elapsedMs,reply:decoded.modelReply};
 });
 if(entries.size!==5+responses.length*2)throw new TypeError("extra or missing evidence");
 return {cpuQuotaMicros,cpuPeriodMicros,memoryLimitBytes,
  processPeakRssBytes,cgroupMemoryPeakBytes,responses};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv[2]!=="--evaluate"||!process.argv[3])throw new Error("evidence file required");
 try{
  const result=evaluateQwenHalfbDiagnostic(parseQwenHalfbDiagnostic(readFileSync(process.argv[3],"utf8")));
  process.stdout.write(JSON.stringify(result)+"\n");
 }catch{
  process.stdout.write(JSON.stringify({
   qualityCandidateForFurtherLab:false,productionInferenceVerified:false,
   publicReleaseApproved:false,error:"qwen_halfb_lab_evidence_invalid"
  })+"\n");
  process.exitCode=1;
 }
}
