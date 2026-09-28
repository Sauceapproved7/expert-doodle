import {fileURLToPath} from "node:url";
import {
  createSmokeScreenDecision,
  createSmokeScreenEnforcementPlan,
} from "../hercules-runtime/smokescreen-agent.mjs";

export const DEFAULT_SMOKESCREEN_BENCHMARK_CORPUS=Object.freeze([
  {id:"benign-health",label:"benign",route:"/health",signals:{requestVelocity:3}},
  {id:"benign-login-typo",label:"benign",route:"/login",signals:{authFailures:1,requestVelocity:4}},
  {id:"benign-api-burst",label:"benign",route:"/v1/projects",signals:{requestVelocity:35}},
  {id:"benign-admin-anomaly",label:"benign-ambiguous",route:"/account/settings",signals:{impossibleSequence:true,privilegeBoundaryProbe:true}},
  {id:"benign-route-walk",label:"benign",route:"/docs",signals:{routeProbes:3,requestVelocity:10}},
  {id:"benign-signature-retry",label:"benign-ambiguous",route:"/v1/session",signals:{signatureMismatches:1,requestVelocity:20}},
  {id:"hostile-recon",label:"hostile",route:"/admin",signals:{routeProbes:20,requestVelocity:90,enumerationPattern:true}},
  {id:"hostile-credential-stuffing",label:"hostile",route:"/login",signals:{authFailures:8,requestVelocity:90,credentialStuffing:true}},
  {id:"hostile-honeytoken",label:"hostile",route:"/internal/export",signals:{honeytokenTouched:true}},
  {id:"hostile-integrity-boundary",label:"hostile",route:"/v1/admin",signals:{signatureMismatches:4,requestVelocity:120,privilegeBoundaryProbe:true}},
  {id:"hostile-boundary-recon",label:"hostile",route:"/root",signals:{routeProbes:20,impossibleSequence:true,privilegeBoundaryProbe:true}},
  {id:"hostile-auth-enumeration",label:"hostile",route:"/users",signals:{authFailures:8,routeProbes:10,enumerationPattern:true}},
]);

function percentile(values,p){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1))];
}

function scenarioDecision(item,hmacKey,index=0){
  return createSmokeScreenDecision({
    sessionId:`benchmark-${item.id}-${index}`,
    route:item.route,
    signals:item.signals,
  },{hmacKey});
}

function isHostile(label){
  return label==="hostile";
}

function isBenign(label){
  return label==="benign"||label==="benign-ambiguous";
}

function safetyViolation(decision){
  if(decision.outboundCounterattack!==false)return true;
  if(decision.scope!=="OWNED_INFRASTRUCTURE_ONLY")return true;
  const plan=createSmokeScreenEnforcementPlan(decision);
  if(plan.executionAuthority!==false||plan.outboundCounterattack!==false)return true;
  if(decision.routeMode==="DECOY"){
    return !(
      plan.mode==="MIRAGE"
      && plan.fallback==="DENY"
      && plan.realAssetAccess===false
      && plan.requiredControls.includes("NO_EGRESS")
      && plan.requiredControls.includes("NO_PRODUCTION_CREDENTIALS")
      && plan.requiredControls.includes("NO_CUSTOMER_DATA")
    );
  }
  return false;
}

export function runSmokeScreenGlobalBenchmark({
  hmacKey,
  corpus=DEFAULT_SMOKESCREEN_BENCHMARK_CORPUS,
  iterations=100,
}={}){
  if(!Number.isInteger(iterations)||iterations<1||iterations>10_000){
    throw new Error("iterations must be an integer from 1 to 10000");
  }
  if(!Array.isArray(corpus)||corpus.length<1){
    throw new Error("corpus must be a non-empty array");
  }

  const outcomes=corpus.map((item,index)=>({
    item,
    decision:scenarioDecision(item,hmacKey,index),
  }));

  const benign=outcomes.filter(({item})=>isBenign(item.label));
  const hostile=outcomes.filter(({item})=>isHostile(item.label));
  const deceptive=outcomes.filter(({decision})=>decision.routeMode==="DECOY");
  const benignDeceptive=benign.filter(({decision})=>decision.routeMode==="DECOY");
  const hostileDetected=hostile.filter(({decision})=>decision.disposition!=="OBSERVE");
  const hostileDeceptive=hostile.filter(({decision})=>decision.routeMode==="DECOY");
  const deceptiveHostile=deceptive.filter(({item})=>isHostile(item.label));
  const governorProtectedBenign=benign.filter(({decision})=>
    decision.governor?.deceptionRequested===true
    && decision.governor?.deceptionAllowed===false
    && decision.routeMode==="REAL"
  ).length;
  const safetyViolations=outcomes.filter(({decision})=>safetyViolation(decision)).length;

  const latencies=[];
  for(let round=0;round<iterations;round+=1){
    for(let index=0;index<corpus.length;index+=1){
      const item=corpus[index];
      const start=performance.now();
      scenarioDecision(item,hmacKey,round*corpus.length+index);
      latencies.push(performance.now()-start);
    }
  }

  const metrics={
    scenarios:corpus.length,
    benignScenarios:benign.length,
    hostileScenarios:hostile.length,
    falsePositiveDeceptionRate:benign.length?benignDeceptive.length/benign.length:1,
    hostileDetectionRate:hostile.length?hostileDetected.length/hostile.length:0,
    hostileDeceptionRate:hostile.length?hostileDeceptive.length/hostile.length:0,
    deceptionPrecision:deceptive.length?deceptiveHostile.length/deceptive.length:0,
    governorProtectedBenign,
    safetyViolations,
    latencyMs:{
      samples:latencies.length,
      mean:latencies.reduce((sum,value)=>sum+value,0)/latencies.length,
      p50:percentile(latencies,50),
      p95:percentile(latencies,95),
      p99:percentile(latencies,99),
      max:Math.max(...latencies),
    },
  };
  const thresholds={
    falsePositiveDeceptionRateMax:0,
    hostileDetectionRateMin:1,
    hostileDeceptionRateMin:1,
    deceptionPrecisionMin:1,
    safetyViolationsMax:0,
    governorProtectedBenignMin:1,
    p95DecisionLatencyMsMax:10,
  };
  const assertions={
    falsePositiveDeceptionRate:metrics.falsePositiveDeceptionRate<=thresholds.falsePositiveDeceptionRateMax,
    hostileDetectionRate:metrics.hostileDetectionRate>=thresholds.hostileDetectionRateMin,
    hostileDeceptionRate:metrics.hostileDeceptionRate>=thresholds.hostileDeceptionRateMin,
    deceptionPrecision:metrics.deceptionPrecision>=thresholds.deceptionPrecisionMin,
    safetyViolations:metrics.safetyViolations<=thresholds.safetyViolationsMax,
    governorProtectedBenign:metrics.governorProtectedBenign>=thresholds.governorProtectedBenignMin,
    p95DecisionLatency:metrics.latencyMs.p95<=thresholds.p95DecisionLatencyMsMax,
  };

  return Object.freeze({
    schema:"hercules.smokescreen.global-benchmark.v1",
    benchmarkDate:"2026-09-28",
    scope:"SYNTHETIC_FIXTURE_ONLY",
    corpusVersion:"1.0.0",
    iterations,
    metrics,
    thresholds,
    assertions,
    passed:Object.values(assertions).every(Boolean),
    productionDetectionRateClaim:false,
    externalPenetrationTestClaim:false,
    competitorPerformanceClaim:false,
    nonClaims:Object.freeze([
      "Synthetic fixture results do not establish production detection rates.",
      "Synthetic fixture results do not establish external penetration-test assurance.",
      "No proprietary competitor product was performance-tested by this harness.",
    ]),
  });
}

async function main(){
  const key=process.env.HERCULES_SMOKESCREEN_BENCHMARK_KEY
    ||"benchmark-only-key-0123456789abcdef";
  const result=runSmokeScreenGlobalBenchmark({hmacKey:key,iterations:250});
  console.log(JSON.stringify(result,null,2));
  if(!result.passed)process.exitCode=1;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch((error)=>{
    console.error(error instanceof Error?error.message:error);
    process.exitCode=1;
  });
}
