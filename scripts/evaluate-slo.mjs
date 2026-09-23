import {mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";

function finiteNumber(value,label){
  const number=Number(value);
  if(!Number.isFinite(number))throw new Error(`invalid_number:${label}`);
  return number;
}

function assertEvidence(item,index){
  if(!item||typeof item!=="object")throw new Error(`invalid_evidence:${index}`);
  if(item.guardrails?.fixtureOnly!==true||item.guardrails?.loopbackOnly!==true)throw new Error(`unsafe_or_unscoped_evidence:${index}`);
  if(item.target?.method!=="GET")throw new Error(`non_readonly_evidence:${index}`);
  if(!item.metrics||typeof item.metrics!=="object")throw new Error(`missing_metrics:${index}`);
  finiteNumber(item.metrics.requests,`requests:${index}`);
  finiteNumber(item.metrics.passed,`passed:${index}`);
  finiteNumber(item.metrics.errors,`errors:${index}`);
  finiteNumber(item.durationMs,`durationMs:${index}`);
  finiteNumber(item.metrics.latencyMs?.p95,`p95:${index}`);
  finiteNumber(item.metrics.latencyMs?.p99,`p99:${index}`);
  const started=new Date(item.startedAt);
  if(Number.isNaN(started.getTime()))throw new Error(`invalid_startedAt:${index}`);
}

export function evaluateSlo(config,evidence){
  if(!config||config.schemaVersion!==1)throw new Error("unsupported_slo_schema");
  if(!Array.isArray(evidence)||evidence.length===0)throw new Error("evidence_required");
  evidence.forEach(assertEvidence);

  const availabilityTarget=finiteNumber(config.objectives?.availability?.goodRequestRatioMin,"availability_target");
  const p95Max=finiteNumber(config.objectives?.latency?.p95MsMax,"p95_target");
  const p99Max=finiteNumber(config.objectives?.latency?.p99MsMax,"p99_target");
  if(availabilityTarget<=0||availabilityTarget>=1)throw new Error("availability_target_out_of_range");

  const totals=evidence.reduce((acc,item)=>({
    requests:acc.requests+Number(item.metrics.requests),
    passed:acc.passed+Number(item.metrics.passed),
    errors:acc.errors+Number(item.metrics.errors),
    durationMs:acc.durationMs+Number(item.durationMs)
  }),{requests:0,passed:0,errors:0,durationMs:0});

  const availability=totals.requests?totals.passed/totals.requests:0;
  const allowedBadRequests=totals.requests*(1-availabilityTarget);
  const budgetConsumedRatio=allowedBadRequests>0?totals.errors/allowedBadRequests:null;
  const p95CompliantWindows=evidence.filter(item=>Number(item.metrics.latencyMs.p95)<=p95Max).length;
  const p99CompliantWindows=evidence.filter(item=>Number(item.metrics.latencyMs.p99)<=p99Max).length;
  const distinctUtcDays=new Set(evidence.map(item=>new Date(item.startedAt).toISOString().slice(0,10))).size;

  const objectiveChecks={
    availability:availability>=availabilityTarget,
    p95EveryWindow:p95CompliantWindows===evidence.length,
    p99EveryWindow:p99CompliantWindows===evidence.length
  };
  const objectivesMet=Object.values(objectiveChecks).every(Boolean);

  const requirements=config.evidenceRequirements||{};
  const evidenceChecks={
    distinctUtcDays:distinctUtcDays>=finiteNumber(requirements.minDistinctUtcDays??1,"minDistinctUtcDays"),
    windows:evidence.length>=finiteNumber(requirements.minWindows??1,"minWindows"),
    totalDuration:totals.durationMs/1000>=finiteNumber(requirements.minTotalDurationSeconds??0,"minTotalDurationSeconds")
  };
  const historyMature=Object.values(evidenceChecks).every(Boolean);

  const status=objectivesMet
    ? historyMature
      ? "attained_with_sampled_evidence"
      : "passing_insufficient_history"
    : "breached";

  return {
    schemaVersion:1,
    evaluation:"Hercules sampled SLO evidence",
    scope:config.scope,
    generatedAt:new Date().toISOString(),
    status,
    productionSlo:Boolean(config.claims?.productionSlo),
    continuousTelemetry:Boolean(config.claims?.continuousTelemetry),
    objectives:{
      availability:{
        target:availabilityTarget,
        observed:availability,
        met:objectiveChecks.availability,
        totalRequests:totals.requests,
        goodRequests:totals.passed,
        badRequests:totals.errors,
        allowedBadRequests,
        budgetConsumedRatio,
        budgetRemainingRatio:budgetConsumedRatio===null?null:1-budgetConsumedRatio
      },
      latency:{
        p95MsMax:p95Max,
        p99MsMax:p99Max,
        windows:evidence.length,
        p95CompliantWindows,
        p99CompliantWindows,
        p95EveryWindow:objectiveChecks.p95EveryWindow,
        p99EveryWindow:objectiveChecks.p99EveryWindow
      }
    },
    evidenceCoverage:{
      windows:evidence.length,
      distinctUtcDays,
      totalDurationSeconds:totals.durationMs/1000,
      requirements:{
        minDistinctUtcDays:Number(requirements.minDistinctUtcDays??1),
        minWindows:Number(requirements.minWindows??1),
        minTotalDurationSeconds:Number(requirements.minTotalDurationSeconds??0)
      },
      checks:evidenceChecks,
      historyMature
    },
    sourceWindows:evidence.map(item=>({
      profile:item.profile,
      startedAt:item.startedAt,
      completedAt:item.completedAt,
      durationMs:item.durationMs,
      requests:item.metrics.requests,
      errors:item.metrics.errors,
      p95Ms:item.metrics.latencyMs.p95,
      p99Ms:item.metrics.latencyMs.p99
    }))
  };
}

function parseArgs(argv){
  const args={config:"observability/slo-baseline.json",evidence:[],output:"benchmarks/observability/slo-evaluation.json"};
  for(let i=0;i<argv.length;i++){
    const value=argv[i];
    if(value==="--config")args.config=argv[++i];
    else if(value==="--evidence")args.evidence.push(argv[++i]);
    else if(value==="--output")args.output=argv[++i];
    else throw new Error(`unknown_argument:${value}`);
  }
  return args;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.evidence.length===0)throw new Error("Pass at least one --evidence file");
  const config=JSON.parse(await readFile(args.config,"utf8"));
  const evidence=[];
  for(const path of args.evidence)evidence.push(JSON.parse(await readFile(path,"utf8")));
  const result=evaluateSlo(config,evidence);
  await mkdir(dirname(args.output),{recursive:true});
  await writeFile(args.output,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify({...result,output:args.output},null,2));
  if(result.status==="breached")process.exitCode=1;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
}
