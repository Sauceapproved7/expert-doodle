import {createAbyssPolicy} from "./abyss-policy.mjs";
const denied=(reason)=>Object.freeze({mode:"deny",reason,mutationAllowed:false,executionAuthority:false});
function exactTrue(fn,arg){try{return typeof fn==="function"&&fn(arg)===true}catch{return false}}
export function createAbyssOrchestrator(boundary={}){
 const policy=createAbyssPolicy();
 function trusted(){
  if(!exactTrue(boundary.emergencyStopClear)) return false;
  try{const t=boundary.assessTrust?.();return t?.identityTrusted===true&&t?.auditTrusted===true}catch{return false}
 }
 return Object.freeze({
  plan(input={}){
   if(!input||typeof input!=="object"||Array.isArray(input)) return denied("invalid-input");
   if(input.selfGrant===true) throw new Error("self-grant denied");
   const cap=policy.capabilities.find(x=>x.id===input.capability);
   if(!cap) return denied("unknown-capability");
   if(!trusted()) return Object.freeze({mode:"blackout",mutationAllowed:false,executionAuthority:false,diagnostics:"read-only"});
   if(cap.environment==="sandbox"){
    if(!exactTrue(boundary.verifySandboxPlan,input)) return denied("verified-sandbox-required");
    return Object.freeze({mode:"adversarial",environment:"sandbox",disposable:true,productionMutation:false,mutationAllowed:false,executionAuthority:false});
   }
   if(!exactTrue(boundary.authorizeMutation,{capability:cap.id,intent:input.intent??input.goal})) return denied("external-authorization-required");
   return Object.freeze({mode:"policy-controlled",mutationAllowed:true,executionAuthority:false,productionMutation:"separate-executor-required"});
  },
  contain({reason}={}){return Object.freeze({reason:reason||"security-event",actions:[...policy.mutiny.controls],requiresBotApproval:false,executionAuthority:false,requiresSeparateExecutor:true})},
  recover(artifact){
   if(!artifact||typeof artifact!=="object"||!exactTrue(boundary.verifyRecoveryArtifact,artifact)) throw new Error("verified signed known-good artifact required");
   return Object.freeze({eligible:true,source:"verified-signed-known-good",trustRunningState:false,executionAuthority:false});
  }
 });
}
