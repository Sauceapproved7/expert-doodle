import {readFileSync} from "node:fs";
import {resolve} from "node:path";

export const HERCULES_TRIAL_MODEL=Object.freeze({
  source:"QuantFactory/SmolLM2-135M-Instruct-GGUF",
  name:"SmolLM2-135M-Instruct.Q4_K_M.gguf",
  license:"apache-2.0",
  bytes:105454144,
  sha256:"8030f04528538d47bda434f6f0bdf3952c40a58123e4d5e755332f23731a8684",
  url:"https://huggingface.co/QuantFactory/SmolLM2-135M-Instruct-GGUF/resolve/476854d00ede130660aba430d15f9347ad2e7d0e/SmolLM2-135M-Instruct.Q4_K_M.gguf",
});
const TESTS=Object.freeze([
  {id:"arithmetic",answer:"4"},
  {id:"capital",answer:"paris"},
  {id:"instruction",answer:"hello"},
]);
function normalize(answer){
  if(typeof answer!=="string")return "";
  return answer.trim().toLowerCase().replace(/[.!?]+$/g,"").trim();
}
export function evaluateRealModelTrial(evidence,{ramLimitBytes=512*1024*1024}={}){
  const answerRows=Array.isArray(evidence?.answers)?evidence.answers:[];
  const rss=evidence?.measuredPeakRssKb;
  const memoryMeasured=typeof rss==="number"&&Number.isFinite(rss)&&rss>0;
  const limitValid=Number.isSafeInteger(ramLimitBytes)&&ramLimitBytes>0;
  const bytes=memoryMeasured?Math.round(rss*1024):null;
  const memoryWithinLimit=Boolean(memoryMeasured&&limitValid&&bytes<=ramLimitBytes);
  let pass=0;
  const samples=TESTS.map(t=>{
    const matching=answerRows.filter(a=>a&&a.id===t.id);
    const raw=matching.length===1?matching[0].output:null;
    const ok=typeof raw==="string"&&raw.length<4096&&normalize(raw)===t.answer;
    if(ok)pass++;
    return {id:t.id,passed:ok,generatedTextPresent:typeof raw==="string"&&raw.trim().length>0};
  });
  const passedAll=pass===TESTS.length&&answerRows.length===TESTS.length;
  return Object.freeze({
    candidate:HERCULES_TRIAL_MODEL.name,
    sampleChecksTotal:TESTS.length,
    sampleChecksPassed:pass,
    sampleResults:samples,
    peakRssBytes:bytes,
    memoryMeasured,
    memoryWithinLimit,
    experimentalEligible:passedAll&&memoryWithinLimit,
    comparableToRenderFreeCpu:false,
    chatInferenceVerifiedForProduction:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
  });
}

export function readTrialEvidence(dir){
  const prefix=resolve(dir);
  const samples=TESTS.map(({id})=>{
    const data=JSON.parse(readFileSync(resolve(prefix,id+".json"),"utf8"));
    return {id,output:data?.choices?.[0]?.message?.content??null};
  });
  const rssRaw=readFileSync(resolve(prefix,"peak-rss-kb.txt"),"utf8").trim();
  const rss=Number(rssRaw);
  return {answers:samples,measuredPeakRssKb:Number.isSafeInteger(rss)&&rss>0?rss:null};
}

if(process.argv[1]&&import.meta.url.endsWith("/"+process.argv[1].split("/").at(-1))&&process.argv.includes("--evaluate")){
  const i=process.argv.indexOf("--evaluate");
  if(i+1>=process.argv.length)throw new Error("evidence directory required");
  try{
    const result=evaluateRealModelTrial(readTrialEvidence(process.argv[i+1]));
    process.stdout.write(JSON.stringify(result)+"\n");
  }catch{
    process.stdout.write(JSON.stringify({experimentalEligible:false,error:"model_trial_evidence_unavailable",publicReleaseApproved:false})+"\n");
    process.exitCode=1;
  }
}
