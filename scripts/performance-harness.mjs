import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {request as httpRequest} from "node:http";
import {request as httpsRequest} from "node:https";

export const profiles={
  smoke:{mode:"requests",concurrency:1,requests:5},
  load:{mode:"requests",concurrency:8,requests:200},
  stress:{mode:"steps",steps:[4,8,16,24],requestsPerStep:100},
  spike:{mode:"requests",concurrency:50,requests:500},
  soak:{mode:"duration",concurrency:6,durationSeconds:900}
};

const allowedPaths=new Set(["/api/health","/api/v10/health","/api/v10/readiness"]);

export function guardTarget(raw){
  const url=new URL(raw);
  const loopback=url.hostname==="localhost"||url.hostname==="127.0.0.1"||url.hostname==="[::1]"||url.hostname==="::1";
  if(!loopback)throw new Error("fixture_guard_rejected_non_loopback_target");
  if(url.protocol!=="http:"&&url.protocol!=="https:")throw new Error("fixture_guard_rejected_protocol");
  if(url.username||url.password||url.search||url.hash)throw new Error("fixture_guard_rejected_sensitive_or_dynamic_url");
  if(!allowedPaths.has(url.pathname))throw new Error("fixture_guard_rejected_path");
  return url;
}

export function percentile(values,p){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1))];
}

function parseArgs(argv){
  const out={profile:"smoke",baseUrl:"http://127.0.0.1:3000",path:"/api/health",confirm:false,output:""};
  for(let i=0;i<argv.length;i++){
    const value=argv[i];
    if(value==="--profile")out.profile=argv[++i];
    else if(value==="--base-url")out.baseUrl=argv[++i];
    else if(value==="--path")out.path=argv[++i];
    else if(value==="--output")out.output=argv[++i];
    else if(value==="--confirm-fixture")out.confirm=true;
    else if(value==="--help")out.help=true;
    else throw new Error(`unknown_argument:${value}`);
  }
  if(!profiles[out.profile])throw new Error(`unknown_profile:${out.profile}`);
  return out;
}

async function one(url,timeoutMs=5000){
  const started=performance.now();
  return new Promise(resolve=>{
    const send=url.protocol==="https:"?httpsRequest:httpRequest;
    const request=send(url,{method:"GET",headers:{"accept":"application/json","x-hercules-benchmark":"fixture-only"},timeout:timeoutMs},response=>{
      const chunks=[];
      response.on("data",chunk=>chunks.push(chunk));
      response.on("end",()=>{
        const body=Buffer.concat(chunks);
        let healthy=false;
        try{healthy=JSON.parse(body.toString("utf8")).ok===true}catch{}
        resolve({latencyMs:performance.now()-started,ok:Number(response.statusCode)>=200&&Number(response.statusCode)<300&&healthy,status:response.statusCode||0,bytes:body.length});
      });
    });
    request.on("timeout",()=>request.destroy(new Error("request_timeout")));
    request.on("error",error=>resolve({latencyMs:performance.now()-started,ok:false,status:0,bytes:0,error:error.message}));
    request.end();
  });
}

async function requestBatch(url,total,concurrency){
  const results=[];
  let cursor=0;
  async function worker(){
    while(cursor<total){cursor++;results.push(await one(url));}
  }
  await Promise.all(Array.from({length:Math.min(concurrency,total)},()=>worker()));
  return results;
}

async function durationBatch(url,durationSeconds,concurrency){
  const results=[];
  const deadline=Date.now()+durationSeconds*1000;
  async function worker(){while(Date.now()<deadline)results.push(await one(url));}
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  return results;
}

function summarize(profile,url,results,startedAt,durationMs){
  const latencies=results.map(x=>x.latencyMs);
  const passed=results.filter(x=>x.ok).length;
  const errors=results.length-passed;
  const errorRate=results.length?errors/results.length:1;
  const thresholds={errorRateMax:0.01,p95LatencyMsMax:500,p99LatencyMsMax:1000};
  const metrics={requests:results.length,passed,errors,errorRate,throughputRps:durationMs?results.length/(durationMs/1000):0,bytes:results.reduce((n,x)=>n+x.bytes,0),latencyMs:{min:Math.min(...latencies),mean:latencies.reduce((a,b)=>a+b,0)/latencies.length,p50:percentile(latencies,50),p95:percentile(latencies,95),p99:percentile(latencies,99),max:Math.max(...latencies)}};
  const assertions={errorRate:metrics.errorRate<=thresholds.errorRateMax,p95:metrics.latencyMs.p95<=thresholds.p95LatencyMsMax,p99:metrics.latencyMs.p99<=thresholds.p99LatencyMsMax};
  return {schemaVersion:1,benchmark:"Hercules Fixture Performance Harness",profile,target:{origin:url.origin,path:url.pathname,method:"GET"},guardrails:{fixtureOnly:true,loopbackOnly:true,allowedPaths:[...allowedPaths],mutations:false},startedAt,completedAt:new Date().toISOString(),durationMs,thresholds,metrics,assertions,passed:Object.values(assertions).every(Boolean)};
}

export async function run({profile,baseUrl,path}){
  const url=guardTarget(new URL(path,baseUrl).toString());
  const spec=profiles[profile];
  const startedAt=new Date().toISOString();
  const start=performance.now();
  let results=[];
  if(spec.mode==="requests")results=await requestBatch(url,spec.requests,spec.concurrency);
  else if(spec.mode==="duration")results=await durationBatch(url,spec.durationSeconds,spec.concurrency);
  else for(const concurrency of spec.steps)results.push(...await requestBatch(url,spec.requestsPerStep,concurrency));
  return summarize(profile,url,results,startedAt,performance.now()-start);
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){console.log("Usage: npm run hercules:perf -- --profile smoke|load|stress|spike|soak --base-url http://127.0.0.1:3000 --path /api/health --confirm-fixture");return;}
  const target=guardTarget(new URL(args.path,args.baseUrl).toString());
  if(!args.confirm){
    console.log(JSON.stringify({dryRun:true,profile:args.profile,target:target.toString(),guard:"Pass --confirm-fixture to execute against this loopback target."},null,2));
    return;
  }
  const result=await run(args);
  const stamp=new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
  const output=args.output||`benchmarks/performance/${stamp}-${args.profile}.json`;
  await mkdir(new URL("../benchmarks/performance/",import.meta.url),{recursive:true});
  await writeFile(output,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify({...result,output},null,2));
  if(!result.passed)process.exitCode=1;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
