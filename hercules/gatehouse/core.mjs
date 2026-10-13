/** Hercules Gatehouse: isolated read-only oversight, never launch/payment authority. */
import {createHash} from "node:crypto";
import {isIP} from "node:net";
import {offlineFloodgateAssessment} from "../floodgates/floodgates-readonly.mjs";

export const SERVICE_NAMES=Object.freeze(["Shopify","Stripe","Render","Supabase","GitHub","DNS","Hercules"]);
export const READ_ONLY=true;

export function assessLaunch(evidence={},now=new Date().toISOString()){
 const gates=offlineFloodgateAssessment(evidence,now);
 return {mode:"read-only",ready:false,productionAuthorized:false,policyReady:gates.policyReady,gates,
   explanation:gates.missing.length
   ? "Gatehouse cannot authorize release. Missing or unverified: "+gates.missing.join(", ")+"."
   : "Claims pass offline checks only; independent privileged release approval remains mandatory.",
   proof:"Telemetry never confers launch authority."};
}

export function sentinelAlerts(signals=[],now=new Date().toISOString(),maxAgeMs=900000){
 const clock=Date.parse(now);
 if(!Number.isFinite(clock))throw new TypeError("Invalid clock");
 const alerts=[];
 for(const signal of signals){
  const service=String(signal?.name||"Unknown").slice(0,80);
  const status=signal?.status;
  const checked=Date.parse(signal?.checkedAt||"");
  if(status==="unreachable"||status==="degraded")
   alerts.push({service,level:"critical",message:"Read-only probe reports "+status+"; verify at the provider."});
  else if(status!=="healthy")
   alerts.push({service,level:"unknown",message:"No verified live status is available."});
  else if(!Number.isFinite(checked)||checked>clock||clock-checked>maxAgeMs)
   alerts.push({service,level:"stale",message:"Health evidence expired or timestamp invalid."});
 }
 return alerts;
}

export function revenueRadar(orders=[]){
 const live=orders.filter(o=>o && o.synthetic!==true && o.source==="provider-attested" && o.attestationValidated===true && o.currency==="USD" && Number.isSafeInteger(o.totalCents) && o.totalCents>=0 && typeof o.id==="string");
 const unique=new Map(live.map(o=>[o.id,o]));
 const verified=[...unique.values()].filter(o=>o.status==="paid");
 const payout=[...unique.values()].filter(o=>o.payoutStatus==="settled" && o.payoutAttestationValidated===true);
 const hasVerifiedData=unique.size>0;
 return {verifiedGrossCents:hasVerifiedData?verified.reduce((a,o)=>a+o.totalCents,0):null,
  verifiedPayoutsCents:hasVerifiedData?payout.reduce((a,o)=>a+(Number.isSafeInteger(o.payoutCents)?o.payoutCents:0),0):null,
  reportedGrossCents:0,verifiedPaidOrderCount:verified.length,
  authoritative:false,source:"isolated-input-only",warning:"No provider source of truth connected. Figures, if any, are from explicitly attested imported records, not a live bank or Shopify reconciliation."};
}

export function recoveryPlan(alerts=[]){
 return {mode:"advisory",canModifyProduction:false,actions:alerts.slice(0,30).map(a=>({
  service:a.service,scope:"local-only",requiresProductionAuthorization:false,
  advice:a.level==="critical"?"Re-run read-only health probe; check provider dashboard and event logs.":"Collect fresh authoritative status."
 })),automaticRecovery:"disabled",rollback:"proposal-only"};
}

export function simulateCheckout({scenario="success"}={}){
 if(!["success","payment-declined","delivery-failed","payout-pending"].includes(scenario))throw new TypeError("Unsupported simulation");
 const steps=[{name:"synthetic cart",result:"pass"},{name:"simulated inventory",result:"pass"},{name:"mock payment",result:scenario==="payment-declined"?"blocked":"pass"}];
 if(scenario!=="payment-declined")steps.push({name:"mock delivery",result:scenario==="delivery-failed"?"blocked":"pass"});
 if(scenario!=="payment-declined"&&scenario!=="delivery-failed")steps.push({name:"mock payout",result:scenario==="payout-pending"?"blocked":"pass"});
 return {scenario,synthetic:true,productionAuthorized:false,moneyMoved:false,externalRequests:0,
  steps,passed:steps.every(x=>x.result==="pass"),notice:"Synthetic results do not verify checkout, customer delivery or payout."};
}

function digest(x){return createHash("sha256").update(JSON.stringify(x)).digest("hex");}
export function newEvidenceLedger(){return [];}
export function appendEvidence(ledger,record){
 if(!Array.isArray(ledger)||!record||typeof record!=="object"||Array.isArray(record))throw new TypeError("Invalid ledger record");
 if(!verifyEvidenceLedger(ledger).ok)throw new Error("Corrupted evidence chain");
 const sanitized={kind:String(record.kind||"unknown").slice(0,50),service:String(record.service||"unknown").slice(0,100),
  state:String(record.state||"unknown").slice(0,100),at:String(record.at||new Date().toISOString()).slice(0,40),
  provenance:String(record.provenance||"local-observation").slice(0,100),authoritative:false};
 const prevHash=ledger.length?ledger.at(-1).hash:null;
 const entry={index:ledger.length,prevHash,record:sanitized};
 return [...ledger,{...entry,hash:digest(entry)}];
}
export function verifyEvidenceLedger(ledger){
 if(!Array.isArray(ledger))return {ok:false,index:0};
 let previous=null;
 for(let i=0;i<ledger.length;i++){
  const {index,prevHash,record,hash}=ledger[i]||{};
  if(index!==i||prevHash!==previous||digest({index,prevHash,record})!==hash)return {ok:false,index:i};
  previous=hash;
 }
 return {ok:true,count:ledger.length,head:previous};
}
export function timeMachine(snapshots=[]){
 const ordered=[...snapshots].sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 const previous=ordered.at(-2)||{signals:[]},next=ordered.at(-1)||{signals:[]};
 const old=new Map((previous.signals||[]).map(s=>[s.name,s.status]));
 const changes=(next.signals||[]).filter(s=>old.get(s.name)!==s.status)
  .map(s=>({service:s.name,previous:old.get(s.name)||"unobserved",current:s.status}));
 return {changes,compared:[previous.at||null,next.at||null],liveRollbackPerformed:false,rollbackMode:"advisory-only"};
}

/** URL validator is intentionally stricter than the web platform URL parser. */
export function validateTarget(value){
 const url=new URL(value);
 if(url.protocol!=="https:"||url.username||url.password||url.port||url.hash||url.search)throw new TypeError("HTTPS status endpoint required");
 const h=url.hostname.toLowerCase();
 if(isIP(h)||h==="localhost"||h.endsWith(".local")||h.endsWith(".internal")||!h.endsWith(".onrender.com"))
   throw new TypeError("Probe outside approved Render hosts");
 if(!/^\/[a-z0-9/_-]*$/i.test(url.pathname))throw new TypeError("Invalid status path");
 return url;
}
