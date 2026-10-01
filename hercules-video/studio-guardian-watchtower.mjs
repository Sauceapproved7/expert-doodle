import {createHash} from "node:crypto";
import {createStudioManifest} from "./studio-contract.mjs";
import {observeGuardianRuntime} from "../hercules-guardian/watchtower.mjs";

function sha(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}

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
  const result=observeGuardianRuntime({
   expected,
   observed,
   target:{id:"studio",scope:"service"}
  });
  return Object.freeze({
   status:result.status,
   results:Object.freeze([Object.freeze({id:"studio",...result})]),
   incidentFingerprints:Object.freeze(result.fingerprint?[result.fingerprint]:[]),
   executionAuthority:false
  });
 };
}
