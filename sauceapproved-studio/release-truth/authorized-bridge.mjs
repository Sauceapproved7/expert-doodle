import {createReleaseTruthEvidenceLedger} from "./evidence-ledger.mjs";

export function createAuthorizedReleaseTruthBridge({authorize,backing=[]}={}){
 if(typeof authorize!=="function") throw new Error("release_truth_authorizer_required");
 const ledger=createReleaseTruthEvidenceLedger({backing});

 async function requireAuthorization(request,action){
  const allowed=await authorize({request,action});
  if(allowed!==true) throw new Error("release_truth_authorization_required");
 }

 async function record({request,evidence}={}){
  await requireAuthorization(request,"record-evidence");
  return ledger.record(evidence);
 }

 async function revoke({request,revocation}={}){
  await requireAuthorization(request,"revoke-evidence");
  return ledger.revoke(revocation);
 }

 function status(){
  const currentEvidence=ledger.currentEvidence();
  return Object.freeze({
   schema:"sauceapproved.studio.release-truth-authorized-bridge/v1",
   historyCount:ledger.history().length,
   currentEvidence,
   mutationPolicy:"trusted-authorization-required",
   unauthenticatedMutationAllowed:false
  });
 }

 return Object.freeze({record,revoke,status});
}
