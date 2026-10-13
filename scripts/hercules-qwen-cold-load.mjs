// Original SauceApproved read-only model cold-load evidence.
// No model downloads, charges, release approvals or production operations here.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

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
  const mem=Number.isSafeInteger(x.peakMemoryBytes)?x.peakMemoryBytes:null;
  const limit=x.memoryLimitBytes;
  const charged=Number.isSafeInteger(x.chargedModelBytes)?x.chargedModelBytes:null;
  const time=Number.isSafeInteger(x.elapsedMs)?x.elapsedMs:null;
  const coldCopyVerified=x.coldCopyCompleted===true&&charged!==null&&
    charged>=QWEN_COLD_LIMITS.minChargedModelBytes&&
    charged<=QWEN_COLD_LIMITS.memoryLimitBytes;
  const evidenceValid=validExit&&coldCopyVerified&&
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
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])throw new TypeError("local evidence file required");
  try{
    const verdict=assessColdLoad(JSON.parse(readFileSync(process.argv[3],"utf8")));
    process.stdout.write(JSON.stringify(verdict)+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      outcome:"inconclusive",eligibleForMoreLab:false,
      productionInferenceVerified:false,publicReleaseApproved:false
    })+"\n");
    process.exitCode=1;
  }
}
