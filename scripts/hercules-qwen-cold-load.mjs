// Original SauceApproved read-only model cold-load evidence.
// No model downloads, charges, release approvals or production operations here.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {parseFreeModelBudgetLog} from "./hercules-render-free-model-budget.mjs";

export const QWEN_COLD_LIMITS=Object.freeze({
  cpuFraction:0.1,
  memoryLimitBytes:512*1024*1024,
  minChargedModelBytes:300000000,
  minimumHeadroomBytes:128*1024*1024,
  maxResponseMs:15000,
});

export function assessColdLoad(observation){
  const x=observation&&typeof observation==="object"?observation:{};
  const validExit=Number.isSafeInteger(x.exitCode)&&x.exitCode===0&&!x.oomKilled;
  const quotaVerified=Number.isSafeInteger(x.cpuQuotaMicros)&&x.cpuQuotaMicros>0&&
    Number.isSafeInteger(x.cpuPeriodMicros)&&x.cpuPeriodMicros>0&&
    x.cpuQuotaMicros/x.cpuPeriodMicros===QWEN_COLD_LIMITS.cpuFraction;
  const mem=Number.isSafeInteger(x.peakMemoryBytes)?x.peakMemoryBytes:null;
  const limit=x.memoryLimitBytes;
  const charged=Number.isSafeInteger(x.chargedModelBytes)?x.chargedModelBytes:null;
  const time=Number.isSafeInteger(x.elapsedMs)?x.elapsedMs:null;
  const coldCopyVerified=x.coldCopyCompleted===true&&charged!==null&&
    charged>=QWEN_COLD_LIMITS.minChargedModelBytes&&
    charged<=QWEN_COLD_LIMITS.memoryLimitBytes;
  const evidenceValid=validExit&&quotaVerified&&coldCopyVerified&&
    limit===QWEN_COLD_LIMITS.memoryLimitBytes&&
    mem!==null&&mem>0&&time!==null&&time>0;
  const memoryHeadroomOk=evidenceValid&&
    (limit-mem)>=QWEN_COLD_LIMITS.minimumHeadroomBytes;
  const choice=x.reply?.choices;
  const body=Array.isArray(choice)&&choice.length===1?choice[0]:null;
  const output=body?.message?.content;
  const modelTextValid=Boolean(
    x.reply?.model==="hercules-trial"&&body?.finish_reason==="stop"&&
    body?.message?.role==="assistant"&&
    typeof output==="string"&&output.trim().length>0&&output.length<=512
  );
  const normalized=modelTextValid?output.trim().toLowerCase().replace(/[.!?]+$/,"").trim():"";
  const correctAnswer=modelTextValid&&(
    normalized==="4"||normalized==="the answer is 4"||
    /^2\s*\+\s*2\s*=\s*4$/.test(normalized)
  );
  const elapsedWithin15s=evidenceValid&&time<=QWEN_COLD_LIMITS.maxResponseMs;
  const eligibleForMoreLab=Boolean(evidenceValid&&memoryHeadroomOk&&
    correctAnswer&&elapsedWithin15s);
  return Object.freeze({
    outcome:x.oomKilled===true?"oom":validExit?"completed":"inconclusive",
    quotaVerified:Boolean(quotaVerified),
    coldCopyVerified:Boolean(coldCopyVerified),
    memoryHeadroomOk:Boolean(memoryHeadroomOk),
    correctAnswer:Boolean(correctAnswer),
    elapsedWithin15s:Boolean(elapsedWithin15s),
    measuredPeakBytes:mem,
    chargedModelBytes:charged,
    observedAnswer:modelTextValid?output.trim().slice(0,120):null,
    eligibleForMoreLab,
    simulatedOnGitHubNotRender:true,
    productionInferenceVerified:false,
    customerChatApproved:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
  });
}
export function parseColdLoadLog(source,{exitCode,oomKilled}={}){
  if(typeof source!=="string"||source.length>22000)
    throw new TypeError("invalid bounded cold-load log");
  if(!Number.isSafeInteger(exitCode)||exitCode<0)
    throw new TypeError("invalid container exit code");
  if(typeof oomKilled!=="boolean")throw new TypeError("invalid OOM observation");
  const keys=new Set([
    "HERCULES_CPU_QUOTA","HERCULES_CPU_PERIOD","HERCULES_MEMORY_LIMIT",
    "HERCULES_COLD_COPY_COMPLETE","HERCULES_CHARGED_MODEL_BYTES",
    "HERCULES_MEMORY_PEAK","HERCULES_PROCESS_PEAK_RSS_BYTES",
    "HERCULES_ELAPSED_MS","HERCULES_MODEL_REPLY_BASE64"
  ]);
  const map=new Map();
  for(const line of source.split(/\r?\n/)){
    if(!line.startsWith("HERCULES_"))continue;
    const hit=/^(HERCULES_[A-Z0-9_]+)=(.*)$/.exec(line);
    if(!hit||!keys.has(hit[1]))throw new TypeError("invalid cold evidence field");
    if(map.has(hit[1]))throw new TypeError("duplicate cold evidence field");
    map.set(hit[1],hit[2]);
  }
  function num(name){
    const value=map.get(name);
    if(value===undefined)return null;
    if(!/^[0-9]+$/.test(value))throw new TypeError("invalid numeric cold evidence");
    const n=Number(value);
    if(!Number.isSafeInteger(n))throw new TypeError("invalid numeric cold evidence");
    return n;
  }
  const o={
    exitCode,oomKilled,
    cpuQuotaMicros:num("HERCULES_CPU_QUOTA"),
    cpuPeriodMicros:num("HERCULES_CPU_PERIOD"),
    memoryLimitBytes:num("HERCULES_MEMORY_LIMIT"),
    coldCopyCompleted:map.get("HERCULES_COLD_COPY_COMPLETE")==="1",
    chargedModelBytes:num("HERCULES_CHARGED_MODEL_BYTES"),
    peakMemoryBytes:num("HERCULES_MEMORY_PEAK"),
    elapsedMs:num("HERCULES_ELAPSED_MS"),
  };
  const reply=map.get("HERCULES_MODEL_REPLY_BASE64");
  if(reply!==undefined){
    const required=[
      "HERCULES_CPU_QUOTA","HERCULES_CPU_PERIOD","HERCULES_MEMORY_LIMIT",
      "HERCULES_MEMORY_PEAK","HERCULES_PROCESS_PEAK_RSS_BYTES",
      "HERCULES_ELAPSED_MS","HERCULES_MODEL_REPLY_BASE64"
    ];
    const decoded=parseFreeModelBudgetLog(
      required.map(k=>k+"="+(map.get(k)??"")).join("\n")
    );
    o.reply=decoded.modelReply;
  }
  return Object.freeze(o);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3]||
    process.argv[4]===undefined||process.argv[5]===undefined)
    throw new TypeError("cold evidence file, exit and OOM status required");
  try{
    const evidence=parseColdLoadLog(readFileSync(process.argv[3],"utf8"),{
      exitCode:Number(process.argv[4]),oomKilled:process.argv[5]==="true"
    });
    process.stdout.write(JSON.stringify(assessColdLoad(evidence))+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      outcome:"inconclusive",eligibleForMoreLab:false,
      productionInferenceVerified:false,publicReleaseApproved:false
    })+"\n");
    process.exitCode=1;
  }
}
