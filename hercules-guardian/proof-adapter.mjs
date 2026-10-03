import {createHash} from "node:crypto";
import {createProofObject} from "../hercules-proof/proof-object.mjs";

function digest(value){
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createGuardianProofObject({guardianResult,authorizationEvidenceSha256}={}){
  if(!guardianResult?.proof) throw new TypeError("guardianResult is required");
  const healthy=guardianResult.verdict==="allow";
  return createProofObject({
    intent:{type:"guardian.runtime.verify",target:guardianResult.proof.target},
    authorization:{evidenceSha256:authorizationEvidenceSha256},
    execution:{status:"OBSERVED",mutation:false},
    verification:{
      status:healthy?"VERIFIED_HEALTHY":"VERIFIED_DRIFT",
      guardianProofId:guardianResult.proof.id,
      drift:guardianResult.drift
    },
    artifact:{sha256:digest(guardianResult.proof),kind:"guardian-proof-of-state"},
    ownership:{holder:"SauceApproved enterprise LLC",module:"Hercules Guardian"},
    rollback:{
      status:guardianResult.recovery.required?"PLANNED":"NOT_REQUIRED",
      target:guardianResult.recovery.handoff,
      executionAuthority:false
    }
  });
}
