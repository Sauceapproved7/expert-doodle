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
  const elapsed=evidence?.elapsedMs;
  const text=evidence?.generatedText;
  const quotaVerified=Number.isSafeInteger(cpu)&&Number.isSafeInteger(period)&&
    period>0 && cpu>0 && cpu/period===RENDER_FREE_LIMITS.cpuFraction &&
    maxMemory===RENDER_FREE_LIMITS.memoryBytes;
  const measurementValid=Number.isSafeInteger(peak)&&peak>0&&
    Number.isSafeInteger(elapsed)&&elapsed>0 &&
    Number.isSafeInteger(maxMemory)&&maxMemory>0;
  const memoryWithinLimit=measurementValid&&peak<=RENDER_FREE_LIMITS.memoryBytes;
  const memoryHeadroomOk=measurementValid&&
    (RENDER_FREE_LIMITS.memoryBytes-peak)>=RENDER_FREE_LIMITS.memoryHeadroomBytes;
  const responseUnder15s=measurementValid&&elapsed<=RENDER_FREE_LIMITS.maxResponseMs;
  const measuredRealText=typeof text==="string"&&text.trim().length>0&&
    text.length<=4096;
  return Object.freeze({
    quotaVerified:Boolean(quotaVerified),
    measurementValid:Boolean(measurementValid),
    measuredRealText:Boolean(measuredRealText),
    memoryWithinLimit:Boolean(memoryWithinLimit),
    memoryHeadroomOk:Boolean(memoryHeadroomOk),
    responseUnder15s:Boolean(responseUnder15s),
    peakMemoryBytes:measurementValid?peak:null,
    elapsedMs:measurementValid?elapsed:null,
    generatedTextExcerpt:measuredRealText?text.trim().slice(0,180):null,
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
    "HERCULES_MEMORY_PEAK","HERCULES_ELAPSED_MS","HERCULES_GENERATED_BASE64"
  ]);
  for(const line of source.split(/\r?\n/)){
    if(!line.startsWith("HERCULES_"))continue;
    const m=/^(HERCULES_[A-Z_]+)=(.*)$/.exec(line);
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
  const encoded=fields.get("HERCULES_GENERATED_BASE64");
  if(encoded.length>5500 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    throw new TypeError("invalid encoded generated text");
  const generatedText=Buffer.from(encoded,"base64").toString("utf8");
  return Object.freeze({
    cpuQuotaMicros:int("HERCULES_CPU_QUOTA"),
    cpuPeriodMicros:int("HERCULES_CPU_PERIOD"),
    memoryLimitBytes:int("HERCULES_MEMORY_LIMIT"),
    peakMemoryBytes:int("HERCULES_MEMORY_PEAK"),
    elapsedMs:int("HERCULES_ELAPSED_MS"),
    generatedText,
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
