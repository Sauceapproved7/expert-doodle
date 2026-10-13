/**
 * Hercules Gatehouse device-only public evidence archive.
 * No transaction data, provider credentials, production controls or network writes.
 */
export const LIMIT=720;
export const RETENTION_DAYS=30;
const SERVICES=new Set(["Hercules MCP","Studio","Smallz","Domain Guard"]);
const STATES=new Set(["reachable","unreachable"]);

export function mergeLocalSamples(previous=[],incoming=[],now=new Date().toISOString()){
 const time=Date.parse(now);
 if(!Number.isFinite(time))throw new TypeError("Invalid archive clock");
 const cutoff=time-RETENTION_DAYS*86400000;
 const combined=[...(Array.isArray(previous)?previous.slice(-LIMIT*2):[]),...(Array.isArray(incoming)?incoming.slice(-LIMIT*2):[])];
 const byStamp=new Map();
 for(const row of combined){
  if(!row||typeof row.sampledAt!=="string")continue;
  const at=Date.parse(row.sampledAt);
  if(!Number.isFinite(at)||at<cutoff||at>time)continue;
  const sampledAt=new Date(at).toISOString();
  if(!Array.isArray(row.signals))continue;
  const byService=new Map();
  for(const signal of row.signals.slice(0,24)){
   if(SERVICES.has(signal?.name)&&STATES.has(signal?.status))
    byService.set(signal.name,{name:signal.name,status:signal.status});
  }
  if(byService.size===0)continue;
  byStamp.set(sampledAt,{sampledAt,signals:[...byService.values()].sort((a,b)=>a.name.localeCompare(b.name))});
 }
 return [...byStamp.values()].sort((a,b)=>a.sampledAt.localeCompare(b.sampledAt)).slice(-LIMIT);
}

/** Transitions between actual samples, never estimated uptime. */
export function listObservedTransitions(samples=[]){
 const changes=[];
 const rows=Array.isArray(samples)?samples:[];
 for(let i=1;i<rows.length;i++){
  const prev=new Map((rows[i-1]?.signals||[]).map(s=>[s.name,s.status]));
  for(const signal of rows[i]?.signals||[]){
   const from=prev.get(signal.name);
   if(from && from!==signal.status)
    changes.push({name:signal.name,from,to:signal.status,sampledAt:rows[i].sampledAt});
  }
 }
 return changes.slice(-30);
}

/** Unsigned, sanitized export, not a financial or production authority record. */
export function makeLocalArchive(samples=[],exportedAt=new Date().toISOString()){
 const cleaned=mergeLocalSamples([],samples,exportedAt);
 return {
  schema:"hercules.gatehouse.device-history.v1",
  scope:"public-service-connectivity",
  exportedAt:new Date(exportedAt).toISOString(),
  storage:"device-export",
  continuousMonitoring:false,providerAttested:false,productionAuthorized:false,
  verifiedSales:null,verifiedPayouts:null,sampleCount:cleaned.length,
  observationsOnly:true,retentionLimit:LIMIT,retentionDays:RETENTION_DAYS,
  warning:"Unsigned browser-collected public connectivity samples. Browser storage may be cleared or evicted. No observation occurs while the page is closed; browser background refresh may be suspended. Do not infer uptime, revenue, payout settlement, or release authorization.",
  samples:cleaned
 };
}
