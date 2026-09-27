import test from "node:test";
import assert from "node:assert/strict";

import {buildFinancialReadinessDossier} from "../hercules-bank/readiness-dossier.mjs";

const approved=(reference)=>({status:"approved",reference,reviewedAt:"2026-09-27T07:00:00Z"});

function readyInputs(){
  return {
    transactionalStore:{
      id:"pg-main",
      environment:"production",
      withTransaction:async(fn)=>fn({}),
      healthCheck:async()=>({ok:true}),
      createBackup:async()=>({id:"backup"}),
      verifyRestore:async()=>({ok:true}),
    },
    secretCustody:{
      providerId:"kms-main",
      environment:"production",
      signDigest:async()=>Buffer.alloc(64),
      describeKey:async()=>({keyId:"key-1",exportable:false,rotationEnabled:true}),
      rotateKey:async()=>({keyId:"key-2"}),
    },
    recoveryEvidence:{
      status:"approved",
      backupReference:"backup:daily",
      restoreTestReference:"restore:recent",
      restoreTestedAt:"2026-09-20T07:00:00Z",
      reviewedAt:"2026-09-27T07:00:00Z",
      rpoMinutes:15,
      rtoMinutes:60,
    },
    caseOperations:{
      fraud:approved("runbook:fraud"),
      disputes:approved("runbook:disputes"),
      returns:approved("runbook:returns"),
      complaints:approved("runbook:complaints"),
      caseRetention:approved("policy:retention"),
    },
    providerCertification:{
      providerAuthorization:approved("contract:sponsor"),
      regulatoryScope:approved("legal:scope"),
      securityReview:approved("review:security"),
      dataProtection:approved("review:data"),
      auditRights:approved("contract:audit"),
      businessContinuity:approved("review:bcp"),
      incidentEscalation:approved("runbook:incident"),
      reconciliationTest:approved("test:reconciliation"),
      exitPlan:approved("runbook:exit"),
    },
  };
}

test("readiness dossier reports missing production controls without exposing dependency functions",()=>{
  const dossier=buildFinancialReadinessDossier({
    complianceSummary:{
      readiness:{ready:false,executionEnabled:false,blockers:["amlProgram: approved review evidence is required"]},
    },
    productionInputs:{},
    now:"2026-09-27T07:00:00Z",
  });

  assert.equal(dossier.ready,false);
  assert.equal(dossier.activationAllowed,false);
  assert.equal(dossier.externalRailsEnabled,false);
  assert.ok(dossier.blockers.length>=2);
  const serialized=JSON.stringify(dossier);
  assert.equal(serialized.includes("withTransaction"),false);
  assert.equal(serialized.includes("signDigest"),false);
});

test("fully green dossier stays locked and returns only sanitized control summaries",()=>{
  const dossier=buildFinancialReadinessDossier({
    complianceSummary:{
      readiness:{ready:true,executionEnabled:false,blockers:[]},
    },
    productionInputs:readyInputs(),
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
  assert.equal(dossier.activationAllowed,false);
  assert.equal(dossier.externalRailsEnabled,false);
  assert.equal(dossier.controls.transactionalStore.ready,true);
  assert.equal(dossier.controls.transactionalStore.id,"pg-main");
  assert.equal(dossier.controls.secretCustody.providerId,"kms-main");
  assert.equal(dossier.controls.recovery.rpoMinutes,15);
  assert.equal(dossier.controls.providerCertification.certified,true);
  assert.equal("withTransaction" in dossier.controls.transactionalStore,false);
  assert.equal("signDigest" in dossier.controls.secretCustody,false);
});
