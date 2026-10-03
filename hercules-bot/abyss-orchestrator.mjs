import {createAbyssPolicy} from "./abyss-policy.mjs";
export function createAbyssOrchestrator(){
 const policy=createAbyssPolicy();
 return Object.freeze({
  plan(input={}){
   if(input.selfGrant) throw new Error("self-grant denied");
   const blackout=policy.blackout({identityTrusted:input.identityTrusted===true,auditTrusted:input.auditTrusted===true});
   if(blackout.mutation==="deny") return Object.freeze({mode:"blackout",mutationAllowed:false,diagnostics:"read-only"});
   const cap=policy.capabilities.find(x=>x.id===input.capability);
   if(cap?.environment==="sandbox") return Object.freeze({mode:"adversarial",environment:"sandbox",disposable:true,productionMutation:false,mutationAllowed:true});
   return Object.freeze({mode:"policy-controlled",mutationAllowed:true,productionMutation:"approval-and-release-gates"});
  },
  contain({reason}={}){
   return Object.freeze({reason:reason||"security-event",actions:[...policy.mutiny.controls],requiresBotApproval:false});
  },
  recover({signed,knownGood}={}){
   if(!signed||!knownGood) throw new Error("signed known-good artifact required");
   return Object.freeze({eligible:true,source:"signed-known-good",trustRunningState:false});
  }
 });
}
