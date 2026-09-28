import {createHash,randomBytes} from "node:crypto";

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const num=(v)=>Number.isFinite(Number(v))?Number(v):0;

export function classifyThreat(signal={}){
  const failedAuth=clamp(num(signal.failedAuth),0,50);
  const scanBreadth=clamp(num(signal.scanBreadth),0,100);
  const requestBurst=clamp(num(signal.requestBurst),0,1000);

  let score=0;
  score+=Math.min(28,failedAuth*4);
  score+=Math.min(28,scanBreadth*2);
  score+=Math.min(24,requestBurst/5);
  if(signal.honeytokenTouched) score+=45;
  if(signal.knownBadIndicator) score+=100;

  score=Math.round(clamp(score,0,100));
  const level=score>=70?"hostile":score>=35?"suspicious":"normal";
  return Object.freeze({level,score});
}

export function buildContainmentPlan(verdict){
  if(!verdict||verdict.level==="normal"){
    return Object.freeze({mode:"observe",realAssetAccess:true,outboundCounterattack:false,controls:["telemetry"]});
  }
  if(verdict.level==="suspicious"){
    return Object.freeze({
      mode:"challenge",
      realAssetAccess:true,
      outboundCounterattack:false,
      controls:["adaptive-rate-limit","step-up-verification","enhanced-telemetry"]
    });
  }
  return Object.freeze({
    mode:"mirage",
    realAssetAccess:false,
    outboundCounterattack:false,
    controls:[
      "session-quarantine",
      "ephemeral-decoy-surface",
      "synthetic-api-topology",
      "honeytoken-telemetry",
      "adaptive-tarpit",
      "credential-canary-rotation",
      "forensic-event-chain"
    ]
  });
}

export function createMirageSession({tenantId="default",verdict,now=Date.now()}={}){
  if(!verdict||verdict.level!=="hostile") throw new Error("Mirage sessions require a hostile verdict");
  const nonce=randomBytes(18).toString("hex");
  const id=createHash("sha256").update(`${tenantId}:${now}:${nonce}`).digest("hex").slice(0,32);
  return Object.freeze({
    id,
    tenantId,
    createdAt:new Date(now).toISOString(),
    expiresAt:new Date(now+15*60*1000).toISOString(),
    networkPolicy:"isolated-no-egress",
    dataPolicy:"synthetic-only",
    realAssetAccess:false,
    outboundCounterattack:false,
    decoySeed:createHash("sha256").update(`mirage:${id}`).digest("hex")
  });
}

export function buildAdaptiveMirage(session,observation={}){
  if(!session||session.realAssetAccess!==false) throw new Error("Mirage must be isolated");
  const interest=String(observation.interest||"generic").replace(/[^a-z0-9_-]/gi,"").slice(0,32)||"generic";
  const epoch=Math.floor(num(observation.step)/3);
  const seed=createHash("sha256").update(`${session.decoySeed}:${interest}:${epoch}`).digest("hex");
  return Object.freeze({
    generation:epoch,
    namespace:`decoy-${seed.slice(0,10)}`,
    apiSurface:[`/api/${interest}/status`,`/api/${interest}/export`],
    honeytoken:`HT-${seed.slice(10,30)}`,
    syntheticRecords:3+(parseInt(seed.slice(0,2),16)%8),
    realAssetAccess:false,
    outboundCounterattack:false
  });
}
