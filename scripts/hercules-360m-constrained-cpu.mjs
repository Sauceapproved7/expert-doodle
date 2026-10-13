// Original Hercules quota-constrained CPU evidence; never a launch or paid-inference decision.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {BENCHMARK_CASES,evaluate360mQuality} from "./hercules-360m-quality-benchmark.mjs";

export const CONSTRAINTS=Object.freeze({
  cpuQuota:15000,cpuPeriod:100000,memoryMaxBytes:536870912,
});
export function evaluateConstrainedCpuEvidence(evidence){
  const rawCpu=typeof evidence?.cpuMax==="string"?evidence.cpuMax.trim():"";
  const cpuQuotaVerified=rawCpu===String(CONSTRAINTS.cpuQuota)+" "+String(CONSTRAINTS.cpuPeriod);
  const memoryLimitVerified=evidence?.memoryMaxBytes===CONSTRAINTS.memoryMaxBytes;
  const peak=evidence?.memoryPeakBytes;
  const validPeak=Number.isSafeInteger(peak)&&peak>0&&peak<=CONSTRAINTS.memoryMaxBytes;
  const noOomKills=evidence?.oomKills===0;
  const report=evaluate360mQuality({
    peakRssKb:validPeak?Math.ceil(peak/1024):null,
    answers:evidence?.answers,
  });
  const complete=Boolean(cpuQuotaVerified&&memoryLimitVerified&&validPeak&&noOomKills&&
    report.measurementComplete);
  return Object.freeze({
    schema:"hercules.model-quality.resource-constrained.v1",
    candidate:"SmolLM2-360M-Instruct.Q4_K_M.gguf",
    resourceTrialCompleted:complete,
    cpuQuotaVerified,
    memoryLimitVerified,
    noOomKills,
    simulatedCpuShares:0.15,
    limitMemoryBytes:CONSTRAINTS.memoryMaxBytes,
    observedCgroupMemoryPeakBytes:validPeak?peak:null,
    sampleChecksTotal:report.sampleChecksTotal,
    semanticChecksPassed:report.semanticChecksPassed,
    formatChecksPassed:report.formatChecksPassed,
    abstentionChecksPassed:report.abstentionChecksPassed,
    p95MeasuredLatencyMs:complete?report.p95ObservedLatencyMs:null,
    experimentWithinQuota:complete,
    experimentalQualityCandidate:complete&&report.experimentalQualityCandidate,
    runtimeMeasuredOnRealRender:false,
    comparableToRenderFreeCpu:false,
    productionConnected:false,
    qualityApprovedForPublicChat:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
    rows:report.rows,
  });
}
function readConstrainedEvidence(dir){
  const path=resolve(dir);
  const read=name=>readFileSync(resolve(path,name),"utf8").trim();
  const events=read("memory.events");
  const oom=events.match(/^oom_kill\s+(\d+)$/m);
  if(!oom)throw new Error("missing OOM event data");
  return {
    cpuMax:read("cpu.max"),
    memoryMaxBytes:Number(read("memory.max")),
    memoryPeakBytes:Number(read("memory.peak")),
    oomKills:Number(oom[1]),
    answers:BENCHMARK_CASES.map(({id})=>{
      const data=JSON.parse(read(id+".json"));
      return {
        id,output:data?.choices?.[0]?.message?.content,
        elapsedMs:Number(read(id+".latency-ms.txt")),
      };
    }),
  };
}
if(process.argv.includes("--evaluate")&&process.argv[1]&&
  import.meta.url.endsWith("/"+process.argv[1].split("/").at(-1))){
  try{
    const i=process.argv.indexOf("--evaluate");
    if(i+1>=process.argv.length)throw new TypeError("evidence path required");
    const result=evaluateConstrainedCpuEvidence(readConstrainedEvidence(process.argv[i+1]));
    process.stdout.write(JSON.stringify(result)+"\n");
    if(!result.resourceTrialCompleted)process.exitCode=1;
  }catch{
    process.stdout.write(JSON.stringify({resourceTrialCompleted:false,
      runtimeMeasuredOnRealRender:false,publicReleaseApproved:false,
      error:"constrained_model_evidence_unavailable"})+"\n");
    process.exitCode=1;
  }
}
