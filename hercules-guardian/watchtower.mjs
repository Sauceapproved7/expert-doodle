import {createHash} from "node:crypto";
import {evaluateGuardianState} from "./guardian.mjs";
import {createGuardianIncidentLedger,appendGuardianIncidentEvent} from "./incident-ledger.mjs";

function digest(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function stable(v){
 if(Array.isArray(v))return v.map(stable);
 if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
 return v;
}

export function observeGuardianRuntime({expected,observed,target,knownIncidentFingerprints=[]}={}){
 const guardian=evaluateGuardianState({expected,observed,target});
 if(guardian.verdict==="allow"){
  return Object.freeze({status:"HEALTHY",guardian,incident:null,fingerprint:null,executionAuthority:false});
 }
 const fingerprint=digest(stable({target:guardian.proof.target,drift:guardian.drift}));
 if(knownIncidentFingerprints.includes(fingerprint)){
  return Object.freeze({status:"INCIDENT_ALREADY_OPEN",guardian,incident:null,fingerprint,executionAuthority:false});
 }
 let incident=createGuardianIncidentLedger({
  incidentId:"guardian-"+fingerprint.slice(0,24),
  target:guardian.proof.target.id
 });
 incident=appendGuardianIncidentEvent(incident,{
  type:"DRIFT_DETECTED",
  evidenceSha256:digest(guardian.proof)
 });
 return Object.freeze({
  status:"INCIDENT_OPENED",
  guardian,
  incident,
  fingerprint,
  executionAuthority:false,
  nextAction:"REVIEW_CONTAINMENT_PROPOSAL"
 });
}
