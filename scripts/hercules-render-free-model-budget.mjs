// First-party, read-only CPU/memory budget evidence. Never grants production access.
// External GGUF and inference runtime are acquired only by isolated test CI.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

export const RENDER_FREE_LIMITS=Object.freeze({
  cpuFraction:0.1,
  memoryBytes:512*1024*1024,
  memoryHeadroomBytes:128*1024*1024,
  maxResponseMs:15000,
});

export function evaluateFreeModelBudget(evidence){
  const cpu=evidence?.cpuQuotaMicros;
  const period=evidence?.cpuPeriodMicros;
  const maxMemory=evidence?.memoryLimitBytes;
  const peak=evidence?.peakMemoryBytes;
  const modelProcessRss=evidence?.modelProcessPeakRssBytes;
  const elapsed=evidence?.elapsedMs;
  const reply=evidence?.modelReply;
  const quotaVerified=Number.isSafeInteger(cpu)&&Number.isSafeInteger(period)&&
    period>0 && cpu>0 && cpu/period===RENDER_FREE_LIMITS.cpuFraction &&
    maxMemory===RENDER_FREE_LIMITS.memoryBytes;
  const measurementValid=Number.isSafeInteger(modelProcessRss)&&modelProcessRss>0&&
    Number.isSafeInteger(peak)&&peak>0&&
    Number.isSafeInteger(elapsed)&&elapsed>0 &&
    Number.isSafeInteger(maxMemory)&&maxMemory>0;
  const conservativePeak=measurementValid?Math.max(peak,modelProcessRss):null;
  const memoryWithinLimit=measurementValid&&conservativePeak<=RENDER_FREE_LIMITS.memoryBytes;
  const memoryHeadroomOk=measurementValid&&
    (RENDER_FREE_LIMITS.memoryBytes-conservativePeak)>=RENDER_FREE_LIMITS.memoryHeadroomBytes;
  const responseUnder15s=measurementValid&&elapsed<=RENDER_FREE_LIMITS.maxResponseMs;
  // Only a structured, completed response from the exact loaded model counts.
  // A CLI startup banner or a successful process exit is not proof of inference.
  const choices=reply?.choices;
  const message=Array.isArray(choices)&&choices.length===1?choices[0]?.message:null;
  const generated=message?.content;
  const measuredRealText=reply?.model==="hercules-trial" &&
    Array.isArray(choices)&&choices.length===1 &&
    choices[0]?.finish_reason==="stop" &&
    message?.role==="assistant" &&
    typeof generated==="string"&&generated.trim().length>0&&generated.length<=4096;
  return Object.freeze({
    quotaVerified:Boolean(quotaVerified),
    measurementValid:Boolean(measurementValid),
    measuredRealText:Boolean(measuredRealText),
    memoryWithinLimit:Boolean(memoryWithinLimit),
    memoryHeadroomOk:Boolean(memoryHeadroomOk),
    responseUnder15s:Boolean(responseUnder15s),
    peakMemoryBytes:measurementValid?peak:null,
    modelProcessPeakRssBytes:measurementValid?modelProcessRss:null,
    conservativePeakBytes:conservativePeak,
    elapsedMs:measurementValid?elapsed:null,
    generatedTextExcerpt:measuredRealText?generated.trim().slice(0,180):null,
    furtherLabEligible:Boolean(quotaVerified&&memoryWithinLimit&&
      memoryHeadroomOk&&responseUnder15s&&measuredRealText),
    comparedUsingGitHubDockerNotRender:true,
    productionInferenceVerified:false,
    customerChatApproved:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
  });
}

export function parseFreeModelBudgetLog(source){
  if(typeof source!=="string"||source.length>20000)
    throw new TypeError("invalid bounded quota evidence log");
  const fields=new Map();
  const required=new Set([
    "HERCULES_CPU_QUOTA","HERCULES_CPU_PERIOD","HERCULES_MEMORY_LIMIT",
    "HERCULES_MEMORY_PEAK","HERCULES_PROCESS_PEAK_RSS_BYTES","HERCULES_ELAPSED_MS","HERCULES_MODEL_REPLY_BASE64"
  ]);
  for(const line of source.split(/\r?\n/)){
    if(!line.startsWith("HERCULES_"))continue;
    const m=/^(HERCULES_[A-Z0-9_]+)=(.*)$/.exec(line);
    if(!m||!required.has(m[1]))throw new TypeError("invalid quota evidence field");
    if(fields.has(m[1]))throw new TypeError("duplicate quota evidence field");
    fields.set(m[1],m[2]);
  }
  if(fields.size!==required.size)throw new TypeError("missing quota evidence field");
  function int(name){
    const value=fields.get(name);
    if(!/^[0-9]+$/.test(value))throw new TypeError("invalid numeric quota evidence");
    const n=Number(value);
    if(!Number.isSafeInteger(n))throw new TypeError("invalid numeric quota evidence");
    return n;
  }
  const encoded=fields.get("HERCULES_MODEL_REPLY_BASE64");
  if(encoded.length>55000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    throw new TypeError("invalid encoded HTTP response");
  const raw=Buffer.from(encoded,"base64");
  const offset=raw.indexOf("\r\n\r\n");
  if(offset<0 || offset>4096)throw new TypeError("invalid HTTP response headers");
  const headers=raw.subarray(0,offset).toString("latin1");
  if(!/^HTTP\/1\.[01] 200\b/.test(headers))throw new TypeError("invalid HTTP status");
  let body=raw.subarray(offset+4);
  const chunked=/^transfer-encoding:\s*chunked\s*$/im.test(headers);
  if(chunked){
    const pieces=[];let cursor=0,total=0;
    for(let i=0;i<128;i++){
      const lineEnd=body.indexOf("\r\n",cursor);
      if(lineEnd<0)throw new TypeError("invalid chunked HTTP body");
      const sizeText=body.subarray(cursor,lineEnd).toString("ascii").split(";")[0];
      if(!/^[0-9a-fA-F]{1,8}$/.test(sizeText))throw new TypeError("invalid HTTP chunk length");
      const size=parseInt(sizeText,16);
      cursor=lineEnd+2;
      if(size===0)break;
      if(cursor+size+2>body.length)throw new TypeError("truncated HTTP chunk");
      pieces.push(body.subarray(cursor,cursor+size));
      total+=size;
      if(total>16384)throw new TypeError("oversized HTTP model reply");
      cursor+=size;
      if(body.toString("latin1",cursor,cursor+2)!=="\r\n")throw new TypeError("invalid HTTP chunk separator");
      cursor+=2;
    }
    body=Buffer.concat(pieces);
  }else{
    const match=/^content-length:\s*(\d+)\s*$/im.exec(headers);
    if(match){
      const bytes=Number(match[1]);
      if(!Number.isSafeInteger(bytes)||bytes!==body.length)throw new TypeError("invalid HTTP content-length");
    }
  }
  if(body.length===0||body.length>16384)throw new TypeError("invalid JSON HTTP body length");
  let modelReply;
  try {modelReply=JSON.parse(body.toString("utf8"));}catch{throw new TypeError("invalid JSON model response")}
  if(!modelReply||typeof modelReply!=="object"||Array.isArray(modelReply))
    throw new TypeError("invalid model response structure");
  return Object.freeze({
    cpuQuotaMicros:int("HERCULES_CPU_QUOTA"),
    cpuPeriodMicros:int("HERCULES_CPU_PERIOD"),
    memoryLimitBytes:int("HERCULES_MEMORY_LIMIT"),
    peakMemoryBytes:int("HERCULES_MEMORY_PEAK"),
    modelProcessPeakRssBytes:int("HERCULES_PROCESS_PEAK_RSS_BYTES"),
    elapsedMs:int("HERCULES_ELAPSED_MS"),
    modelReply,
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])throw new TypeError("evidence file required");
  try{
    const result=evaluateFreeModelBudget(
      parseFreeModelBudgetLog(readFileSync(process.argv[3],"utf8")));
    process.stdout.write(JSON.stringify(result)+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      quotaVerified:false,furtherLabEligible:false,
      productionInferenceVerified:false,publicReleaseApproved:false,
      error:"render_free_budget_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
