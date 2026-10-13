// Original Hercules ARM64 model-readiness lab; no Oracle account or production authority.
// No vendor weights bundled. All answers must come from real pinned local inference.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

export const HERCULES_ARM_LAB_MODEL=Object.freeze({
 source:"bartowski/Qwen2.5-0.5B-Instruct-GGUF",
 file:"Qwen2.5-0.5B-Instruct-Q3_K_S.gguf",
 revision:"eadd1b868ae382c989d828189bdb8e5d34dc675c",
 sha256:"468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34",
 license:"apache-2.0",
 weightsOwnedBySauceApproved:false
});

const QUESTIONS=Object.freeze({
 addition:["4","the answer is 4","2 + 2 = 4"],
 comparison:["12","12 is larger","the answer is 12"],
 capital:["paris","the capital of france is paris"]
});
const MAX_RSS_BYTES=6*1024*1024*1024;

export function assessArmInferenceLab(evidence){
 const armArchitectureVerified=evidence?.arch==="arm64"&&evidence.requestedThreads===2;
 const peak=evidence?.measuredPeakRssBytes;
 const measuredRam=Number.isSafeInteger(peak)&&peak>0&&peak<MAX_RSS_BYTES;
 const rows=Array.isArray(evidence?.answers)?evidence.answers:[];
 const ids=Object.keys(QUESTIONS);
 const complete=rows.length===ids.length&&new Set(rows.map(x=>x?.id)).size===ids.length;
 const samples=ids.map(id=>{
   const found=rows.filter(x=>x&&x.id===id);
   const x=found.length===1?found[0]:null;
   const value=x?.output;
   const valid=Boolean(x?.model==="hercules-arm-trial" &&
      x?.finishReason==="stop" &&typeof value==="string" &&
      value.trim().length>0&&value.length<=512&&
      Number.isSafeInteger(x?.elapsedMs)&&x.elapsedMs>0&&x.elapsedMs<=15000);
   const normalized=valid?value.trim().toLowerCase().replace(/[.!?]+$/,"").trim():"";
   const correct=valid&&QUESTIONS[id].includes(normalized);
   return {id,valid,correct,elapsedMs:valid?x.elapsedMs:null,
     outputExcerpt:valid?value.trim().slice(0,120):null};
 });
 const correctAnswers=samples.filter(x=>x.correct).length;
 const modelResponsesValid=samples.filter(x=>x.valid).length;
 return Object.freeze({
   schema:"hercules.model.arm64-candidate-lab.v1",
   architecture:"arm64",
   model:HERCULES_ARM_LAB_MODEL.file,
   armArchitectureVerified,
   twoInferenceThreadsVerified:armArchitectureVerified,
   peakRssBytes:measuredRam?peak:null,
   modelResponsesValid,
   correctAnswers,
   samples,
   armLabEligible:Boolean(armArchitectureVerified&&measuredRam&&complete&&
      modelResponsesValid===3&&correctAnswers===3),
   githubArmRunnerNotOCI:true,
   ociInstanceProvisioned:false,
   ociFreeAllowanceVerifiedForAccount:false,
   productionInferenceVerified:false,
   publicReleaseApproved:false,
   paidCommerceEnabled:false
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--evaluate"||!process.argv[3])throw new TypeError("bounded evidence path required");
  try{
    const evidence=JSON.parse(readFileSync(process.argv[3],"utf8"));
    const summary=assessArmInferenceLab(evidence);
    process.stdout.write(JSON.stringify(summary)+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      armLabEligible:false,ociInstanceProvisioned:false,
      publicReleaseApproved:false,error:"arm_model_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
