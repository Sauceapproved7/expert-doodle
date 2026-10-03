import {observeGuardianRuntime} from "./watchtower.mjs";

function text(v,label){if(typeof v!=="string"||!v.trim())throw new Error(label+" is required");return v.trim()}
function baseline(v){if(!v||typeof v!=="object")throw new Error("Watchtower baseline is required");return Object.freeze(structuredClone(v))}

export function createWatchtowerRegistry(services=[]){
 if(!Array.isArray(services)||services.length===0)throw new Error("Watchtower services are required");
 const seen=new Set();
 const normalized=services.map(service=>{
  const id=text(service.id,"Watchtower service id");
  if(seen.has(id))throw new Error("duplicate Watchtower service id");
  seen.add(id);
  if(typeof service.observe!=="function")throw new Error("Watchtower observe function is required");
  return Object.freeze({id,scope:text(service.scope,"Watchtower service scope"),baseline:baseline(service.baseline),observe:service.observe});
 });
 return Object.freeze(normalized);
}

export async function runWatchtowerCycle(registry,{knownIncidentFingerprints=[]}={}){
 const results=[];
 const fingerprints=new Set(knownIncidentFingerprints);
 for(const service of registry){
  try{
   const observed=await service.observe();
   const result=observeGuardianRuntime({
    expected:service.baseline,
    observed,
    target:{id:service.id,scope:service.scope},
    knownIncidentFingerprints:[...fingerprints]
   });
   if(result.fingerprint)fingerprints.add(result.fingerprint);
   results.push(Object.freeze({id:service.id,...result}));
  }catch(error){
   results.push(Object.freeze({
    id:service.id,
    status:"OBSERVATION_FAILED",
    reason:String(error?.message??"observation failed"),
    incident:null,
    fingerprint:null,
    executionAuthority:false
   }));
  }
 }
 return Object.freeze({
  status:results.some(x=>x.status==="INCIDENT_OPENED")?"INCIDENTS_PRESENT":results.some(x=>x.status==="OBSERVATION_FAILED")?"DEGRADED":"HEALTHY",
  results:Object.freeze(results),
  incidentFingerprints:Object.freeze([...fingerprints]),
  executionAuthority:false
 });
}
