const SHA=/^[a-f0-9]{64}$/i;

function validatePlan(plan){
 if(plan?.status!=="AUTHORIZED_PLAN"||plan?.requiresSeparateExecutor!==true) throw new Error("authorized containment plan is required");
 if(plan.executionAuthority!==false) throw new Error("containment plan must not carry execution authority");
 if(plan.action?.type!=="guardian.containment.isolate"||!plan.action?.target||!plan.action?.scope) throw new Error("scoped containment action is required");
 if(!SHA.test(plan.authorizationEvidenceSha256??"")) throw new Error("plan authorization evidence is required");
}

function validateAdapter(adapter){
 if(typeof adapter?.isolate!=="function"||typeof adapter?.rollback!=="function") throw new Error("rollback-capable containment adapter is required");
}

function validateExecutionAuthorization(plan,auth){
 if(auth?.approved!==true||!SHA.test(auth?.evidenceSha256??"")) throw new Error("explicit execution authorization is required");
 if(auth.target!==plan.action.target||auth.scope!==plan.action.scope) throw new Error("execution authorization does not match containment target");
}

export async function executeGuardianContainment({mode="DRY_RUN",plan,executionAuthorization,adapter}={}){
 validatePlan(plan);
 validateAdapter(adapter);
 if(mode!=="DRY_RUN"&&mode!=="LIVE") throw new Error("containment mode must be DRY_RUN or LIVE");

 const base=Object.freeze({
  action:plan.action,
  planAuthorizationEvidenceSha256:plan.authorizationEvidenceSha256
 });

 if(mode==="DRY_RUN"){
  return Object.freeze({mode,executed:false,rollbackAvailable:true,...base});
 }

 validateExecutionAuthorization(plan,executionAuthorization);
 const evidence=await adapter.isolate({
  target:plan.action.target,
  scope:plan.action.scope,
  authorizationEvidenceSha256:executionAuthorization.evidenceSha256
 });
 if(evidence?.isolated!==true) throw new Error("containment adapter did not verify isolation");

 return Object.freeze({
  mode,
  executed:true,
  rollbackAvailable:true,
  executionAuthorizationEvidenceSha256:executionAuthorization.evidenceSha256,
  evidence,
  ...base
 });
}
