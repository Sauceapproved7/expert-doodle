import {createHash} from "node:crypto";
import {createGuardianProofObject} from "./proof-adapter.mjs";
import {createConsequenceEnvelope} from "../hercules-consequence/consequence-envelope.mjs";
import {bindProofToConsequence} from "../hercules-proof/proof-consequence-binding.mjs";
import {createRestorePoint,planRecovery} from "../hercules-time-machine/time-machine.mjs";
import {createExecutionLifecycle} from "../hercules-runtime/execution-lifecycle.mjs";

function digest(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex");}

export function createGuardianContainmentProposal({guardianResult,authorizationEvidenceSha256}={}){
 if(guardianResult?.verdict!=="deny"||!guardianResult?.drift?.length) throw new Error("verified drift required");
 const target=guardianResult.proof?.target;
 if(!target?.id||!target?.scope) throw new Error("scoped target required");

 const proof=createGuardianProofObject({guardianResult,authorizationEvidenceSha256});
 const consequence=createConsequenceEnvelope({
  action:{type:"guardian.isolate_target",target:target.id,scope:target.scope},
  authority:{maxImpact:"RESOURCE",evidenceSha256:authorizationEvidenceSha256},
  effects:[{resource:target.id,impact:"RESOURCE",reversibility:"ROLLBACK",verified:true}],
  uncertainty:[]
 });
 const binding=bindProofToConsequence({proof,consequence});
 const beforeSha=digest({target,observed:guardianResult.proof.observed});
 const afterSha=digest({target,state:"isolated-proposed",guardianProofId:guardianResult.proof.id});
 const restore=createRestorePoint({
  action:{type:"guardian.isolate_target",target:target.id},
  authorization:{evidenceSha256:authorizationEvidenceSha256},
  before:{sha256:beforeSha,state:"observed-runtime"},
  after:{sha256:afterSha,state:"proposed-isolation"},
  recovery:{type:"ROLLBACK",target:"verified-pre-isolation-state",verified:true},
  dependencies:[target.id]
 });
 const recovery=planRecovery(restore);
 const lifecycle=createExecutionLifecycle({
  intent:{id:guardianResult.proof.id,type:"guardian.containment"},
  authorization:{evidenceSha256:authorizationEvidenceSha256},
  proof,consequence,binding,restore
 });
 return Object.freeze({proof,consequence,binding,restore,recovery,lifecycle});
}
