import {createHash} from "node:crypto";

function digest(value){
 return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function verifyGuardianContainment({execution,observation}={}){
 if(execution?.executed!==true) throw new Error("executed containment evidence is required");
 const target=execution.action?.target, scope=execution.action?.scope;
 if(!target||!scope) throw new Error("scoped containment execution is required");
 if(observation?.target!==target||observation?.scope!==scope) throw new Error("observation does not match containment target");

 const verified=observation.isolated===true;
 const verificationEvidenceSha256=digest({target,scope,observation});

 if(verified){
  return Object.freeze({
   status:"VERIFIED_CONTAINED",
   target,scope,
   verificationEvidenceSha256,
   rollbackProposal:null,
   executionAuthority:false
  });
 }

 return Object.freeze({
  status:"CONTAINMENT_UNVERIFIED",
  target,scope,
  verificationEvidenceSha256,
  executionAuthority:false,
  rollbackProposal:Object.freeze({
   required:true,
   type:"guardian.rollback.proposal",
   target,scope,
   reason:"containment_verification_failed",
   executionAuthority:false,
   requiresApproval:true,
   sourceExecutionAuthorizationEvidenceSha256:execution.executionAuthorizationEvidenceSha256??null
  })
 });
}
