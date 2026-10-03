export function createTrustedReleaseTruthOperator({authorize,ledger}={}){
 if(typeof authorize!=="function") throw new Error("release_truth_operator_authorizer_required");
 if(!ledger||typeof ledger.record!=="function"||typeof ledger.revoke!=="function") throw new Error("release_truth_operator_ledger_required");

 async function requireAuthorization(request,action){
  const allowed=await authorize(Object.freeze({...request,action}));
  if(allowed!==true) throw new Error("release_truth_operator_authorization_required");
 }
 async function record(request={},entry={}){
  await requireAuthorization(request,"record-evidence");
  return ledger.record(entry);
 }
 async function revoke(request={},entry={}){
  await requireAuthorization(request,"revoke-evidence");
  return ledger.revoke(entry);
 }
 return Object.freeze({
  record,revoke,
  mutationPolicy:"trusted-operator-only",
  publicHttpMutationAllowed:false
 });
}
