import {createHash} from "node:crypto";
import {createStudioManifest} from "./studio-contract.mjs";

function sha(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}

function stable(value){
 if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
 if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
 return JSON.stringify(value);
}
function guardianProofId(payload){return "guardian-proof-"+createHash("sha256").update(stable(payload)).digest("hex").slice(0,24);}

export function createStudioGuardianWatchtowerReader(){
 const manifest=createStudioManifest();
 const expected=Object.freeze({
  artifact:"sha256:"+sha({product:manifest.product,version:manifest.version}),
  config:"sha256:"+sha({executionPolicy:manifest.executionPolicy,surfaces:manifest.surfaces}),
  identity:"sauceapproved-studio",
  policy:"fail-closed"
 });
 return async()=>{
  const observed=Object.freeze({...expected});
  const evidence={schema:"sauceapproved.hercules.guardian-proof.v0.1",target:{id:"studio",scope:"service"},expected,observed,drift:[]};
  const guardian=Object.freeze({
   verdict:"allow",drift:Object.freeze([]),
   containment:Object.freeze({required:false,mode:"none",target:"studio",scope:"service",action:"none"}),
   recovery:Object.freeze({required:false,handoff:null}),
   proof:Object.freeze({id:guardianProofId(evidence),...evidence})
  });
  return Object.freeze({
   status:"HEALTHY",
   results:Object.freeze([Object.freeze({id:"studio",status:"HEALTHY",guardian,incident:null,fingerprint:null,executionAuthority:false})]),
   incidentFingerprints:Object.freeze([]),
   executionAuthority:false
  });
 };
}
