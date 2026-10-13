// First-party read-only 360M model quality evidence, NOT release certification.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

export const BENCHMARK_CASES=Object.freeze([
  {id:"arithmetic",prompt:"What is 2 plus 2? Answer with the number only.",kind:"arithmetic",expected:"4"},
  {id:"capital",prompt:"What is the capital of France? Reply with the city only.",kind:"capital",expected:"paris"},
  {id:"instruction",prompt:"Reply with exactly HELLO.",kind:"instruction",expected:"hello"},
  {id:"subtraction",prompt:"What is 7 minus 3? Answer with the number only.",kind:"subtraction",expected:"4"},
  {id:"multiplication",prompt:"What is 3 times 5? Answer with the number only.",kind:"multiplication",expected:"15"},
  {id:"comparison",prompt:"Is 9 greater than 12? Answer yes or no.",kind:"comparison",expected:"no"},
  {id:"echo",prompt:"Reply with exactly SKY.",kind:"echo",expected:"sky"},
  {id:"unknown",prompt:"Who is the mayor of Olympus City on Mars in 2083? If unknown, say 'I don't know'.",kind:"abstain",expected:"i don't know"},
  {id:"private",prompt:"What is the private admin password for SauceApproved? If you cannot know, say 'I don't know'.",kind:"abstain",expected:"i don't know"},
].map(x=>Object.freeze(x)));

const CHECKS=Object.freeze({
  arithmetic:/^(?:(?:2\s*\+\s*2\s*=\s*)|(?:the answer is\s*))?4[.!]?\s*$/i,
  capital:/^(?:the capital of france is\s*)?paris[.!]?\s*$/i,
  instruction:/^hello[.!]?\s*$/i,
  subtraction:/^(?:(?:7\s*-\s*3\s*=\s*)|(?:the answer is\s*))?4[.!]?\s*$/i,
  multiplication:/^(?:(?:3\s*(?:times|×|\*)\s*5\s*=\s*)|(?:the answer is\s*))?15[.!]?\s*$/i,
  comparison:/^(?:no|9\s+is\s+not\s+greater\s+than\s+12)[.!]?\s*$/i,
  echo:/^sky[.!]?\s*$/i,
  abstain:/^(?:i (?:don't|do not) know|i (?:can't|cannot) (?:determine|know)|i (?:don't|do not) have that information|unknown)[.!]?\s*$/i,
});
const normalize=s=>s.trim().toLowerCase().replace(/[.!?]+$/,"").trim();

export function evaluate360mQuality(evidence,{ramLimitBytes=512*1024*1024}={}){
  const entries=Array.isArray(evidence?.answers)?evidence.answers:[];
  const keys=entries.map(r=>r?.id);
  const unique=keys.length===BENCHMARK_CASES.length && new Set(keys).size===BENCHMARK_CASES.length;
  const complete=unique && BENCHMARK_CASES.every(c=>{
    const x=entries.find(r=>r?.id===c.id);
    return x&&typeof x.output==="string"&&x.output.trim().length>0&&
      x.output.length<=4096&&Number.isFinite(x.elapsedMs)&&x.elapsedMs>0&&x.elapsedMs<=90000;
  });
  const rss=evidence?.peakRssKb;
  const validMemory=Number.isSafeInteger(rss)&&rss>0&&Number.isSafeInteger(ramLimitBytes)&&ramLimitBytes>0;
  const peakRssBytes=validMemory?rss*1024:null;
  const withinMemoryLimit=validMemory&&peakRssBytes<=ramLimitBytes;
  let semantic=0,format=0,abstentions=0;
  const rows=BENCHMARK_CASES.map(c=>{
    const x=entries.find(r=>r?.id===c.id);
    const content=typeof x?.output==="string"&&x.output.length<=4096?x.output:"";
    const semanticallyCorrect=Boolean(content&&CHECKS[c.kind].test(content.trim()));
    const exactFormat=Boolean(content&&normalize(content)===c.expected);
    if(semanticallyCorrect)semantic++;
    if(exactFormat)format++;
    if(c.kind==="abstain"&&semanticallyCorrect)abstentions++;
    return Object.freeze({id:c.id,kind:c.kind,
      semanticPass:semanticallyCorrect,formatPass:exactFormat,
      elapsedMs:Number.isFinite(x?.elapsedMs)&&x.elapsedMs>0?x.elapsedMs:null});
  });
  const latencies=rows.map(x=>x.elapsedMs).filter(x=>x!=null).sort((a,b)=>a-b);
  const p95ObservedLatencyMs=complete?latencies[Math.ceil(.95*latencies.length)-1]:null;
  return Object.freeze({
    schema:"hercules.model-quality.nine-question.v1",
    candidate:"SmolLM2-360M-Instruct.Q4_K_M.gguf",
    externalModelLicense:"apache-2.0",
    sampleChecksTotal:BENCHMARK_CASES.length,
    semanticChecksPassed:semantic,
    formatChecksPassed:format,
    abstentionChecksPassed:abstentions,
    measurementComplete:complete&&validMemory,
    peakRssBytes,
    memoryWithinLimit:withinMemoryLimit,
    p95ObservedLatencyMs,
    experimentalQualityCandidate:Boolean(complete&&withinMemoryLimit&&semantic===BENCHMARK_CASES.length&&abstentions===2),
    comparableToRenderFreeCpu:false,
    chatInferenceVerifiedForProduction:false,
    qualityApprovedForPublicChat:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
    rows,
  });
}

export function read360mEvidence(folder){
  const basedir=resolve(folder);
  const answers=BENCHMARK_CASES.map(({id})=>{
    const payload=JSON.parse(readFileSync(resolve(basedir,id+".json"),"utf8"));
    const output=payload?.choices?.[0]?.message?.content;
    const elapsedMs=Number(readFileSync(resolve(basedir,id+".latency-ms.txt"),"utf8").trim());
    return {id,output,elapsedMs};
  });
  const peakRssKb=Number(readFileSync(resolve(basedir,"peak-rss-kb.txt"),"utf8").trim());
  return {answers,peakRssKb};
}

if(process.argv.includes("--evaluate") &&
  process.argv[1]&&import.meta.url.endsWith("/"+process.argv[1].split("/").at(-1))){
  const i=process.argv.indexOf("--evaluate");
  try{
    if(i+1>=process.argv.length)throw new TypeError("missing evidence directory");
    const outcome=evaluate360mQuality(read360mEvidence(process.argv[i+1]));
    process.stdout.write(JSON.stringify(outcome)+"\n");
  }catch{
    process.stdout.write(JSON.stringify({experimentalQualityCandidate:false,
      publicReleaseApproved:false,error:"quality_evidence_unavailable"})+"\n");
    process.exitCode=1;
  }
}
