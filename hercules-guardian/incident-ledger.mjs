import {createHash} from "node:crypto";

const SHA=/^[a-f0-9]{64}$/i;
const TYPES=new Set([
 "DRIFT_DETECTED","CONTAINMENT_PROPOSED","CONTAINMENT_AUTHORIZED",
 "CONTAINMENT_EXECUTED","CONTAINMENT_VERIFIED","CONTAINMENT_UNVERIFIED",
 "ROLLBACK_PROPOSED","ROLLBACK_AUTHORIZED","ROLLBACK_EXECUTED","RECOVERY_VERIFIED"
]);

function stable(v){
 if(Array.isArray(v))return v.map(stable);
 if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
 return v;
}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");}
function requiredText(v,label){if(typeof v!=="string"||!v.trim())throw new Error(label+" is required");return v.trim();}

export function createGuardianIncidentLedger({incidentId,target}={}){
 return Object.freeze({
  schema:"hercules.guardian.incident-ledger.v1",
  incidentId:requiredText(incidentId,"incident id"),
  target:requiredText(target,"target"),
  events:Object.freeze([])
 });
}

export function appendGuardianIncidentEvent(ledger,event={}){
 if(ledger?.schema!=="hercules.guardian.incident-ledger.v1"||!Array.isArray(ledger.events))throw new Error("valid Guardian incident ledger is required");
 if(!TYPES.has(event.type))throw new Error("unsupported Guardian incident event");
 if(!SHA.test(event.evidenceSha256??""))throw new Error("valid evidence digest is required");
 const previous=ledger.events.at(-1)?.eventSha256??null;
 const sequence=ledger.events.length+1;
 const payload=stable({
  sequence,
  type:event.type,
  evidenceSha256:event.evidenceSha256.toLowerCase(),
  previousEventSha256:previous,
  target:ledger.target
 });
 const next=Object.freeze({...payload,eventSha256:digest(payload)});
 return Object.freeze({...ledger,events:Object.freeze([...ledger.events,next])});
}

export function verifyGuardianIncidentLedger(ledger={}){
 if(ledger.schema!=="hercules.guardian.incident-ledger.v1"||!Array.isArray(ledger.events))return Object.freeze({valid:false,reason:"INVALID_LEDGER"});
 let previous=null;
 for(let i=0;i<ledger.events.length;i++){
  const event=ledger.events[i];
  if(event.sequence!==i+1||event.previousEventSha256!==previous||!TYPES.has(event.type)||!SHA.test(event.evidenceSha256??""))return Object.freeze({valid:false,reason:"CHAIN_MISMATCH",sequence:i+1});
  const {eventSha256,...payload}=event;
  if(!SHA.test(eventSha256??"")||digest(payload)!==eventSha256)return Object.freeze({valid:false,reason:"DIGEST_MISMATCH",sequence:i+1});
  previous=eventSha256;
 }
 return Object.freeze({valid:true,reason:"VERIFIED",events:ledger.events.length,headSha256:previous});
}
