import test from "node:test";
import assert from "node:assert/strict";

import {buildFinancialReadinessDossier} from "../hercules-bank/readiness-dossier.mjs";

const approved=(reference)=>({status:"approved",reference,reviewedAt:"2026-09-27T07:00:00Z"});

function productionInputs(){
  return {
    transactionalStore:{id:"pg-main",environment:"production",withTransaction:async(fn)=>fn({}),healthCheck:async()=>({ok:true}),createBackup:async()=>({id:"backup"}),verifyRestore:async()=>({ok:true})},
    secretCustody:{providerId:"kms-main",environment:"production",signDigest:async()=>Buffer.alloc(64),describeKey:async()=>({keyId:"key-1",exportable:false,rotationEnabled:true}),rotateKey:async()=>({keyId:"key-2"})},
    recoveryEvidence:{status:"approved",backupReference:"backup:daily",restoreTestReference:"restore:recent",restoreTestedAt:"2026-09-20T07:00:00Z",reviewedAt:"2026-09-27T07:00:00Z",rpoMinutes:15,rtoMinutes:60},
    caseOperations:{fraud:approved("runbook:fraud"),disputes:approved("runbook:disputes"),returns:approved("runbook:returns"),complaints:approved("runbook:complaints"),caseRetention:approved("policy:retention")},
    providerCertification:{providerAuthorization:approved("contract:sponsor"),regulatoryScope:approved("legal:scope"),securityReview:approved("review:security"),dataProtection:approved("review:data"),auditRights:approved("contract:audit"),businessContinuity:approved("review:bcp"),incidentEscalation:approved("runbook:incident"),reconciliationTest:approved("test:reconciliation"),exitPlan:approved("runbook:exit")},
  };
}

test("green infrastructure is downgraded when adapter qualification evidence is stale",()=>{
  const dossier=buildFinancialReadinessDossier({
    complianceSummary:{readiness:{ready:true,executionEnabled:false,blockers:[]}},
    productionInputs:productionInputs(),
    qualificationEvidenceStatus:{
      ready:false,
      stale:true,
      identityChanged:false,
      blockers:["qualification evidence expired"],
      activationAllowed:false,
      externalRailsEnabled:false,
    },
    now:"2026-09-27T07:00:00Z",
  });
  assert.equal(dossier.ready,false);
  assert.equal(dossier.controls.adapterQualification.ready,false);
  assert.match(dossier.blockers.join("\n"),/qualification evidence expired/i);
  assert.equal(dossier.activationAllowed,false);
  assert.equal(dossier.externalRailsEnabled,false);
});

test("green infrastructure plus fresh matching qualification evidence remains readiness-green but locked",()=>{
  const dossier=buildFinancialReadinessDossier({
    complianceSummary:{readiness:{ready:true,executionEnabled:false,blockers:[]}},
    productionInputs:productionInputs(),
    qualificationEvidenceStatus:{
      ready:true,
      stale:false,
      identityChanged:false,
      qualifiedAt:"2026-09-27T06:00:00Z",
      expiresAt:"2026-10-04T06:00:00Z",
      blockers:[],
      activationAllowed:false,
      externalRailsEnabled:false,
    },
    now:"2026-09-27T07:00:00Z",
  });
  assert.equal(dossier.ready,true);
  assert.equal(dossier.controls.adapterQualification.ready,true);
  assert.equal(dossier.activationAllowed,false);
  assert.equal(dossier.externalRailsEnabled,false);
});
