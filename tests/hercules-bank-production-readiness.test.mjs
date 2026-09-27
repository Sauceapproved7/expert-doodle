import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateFinancialProductionReadiness,
  validateTransactionalFinancialStoreAdapter,
  validateSecretCustodyAdapter,
  validateRecoveryEvidence,
  validateFinancialCaseOperations,
  certifyFinancialProviderOnboarding,
} from "../hercules-bank/production-readiness.mjs";

const approved=(reference)=>({status:"approved",reference,reviewedAt:"2026-09-27T07:00:00Z"});

test("transactional financial store requires atomic transaction and health capabilities",()=>{
  assert.throws(()=>validateTransactionalFinancialStoreAdapter({
    id:"pg-main",
    environment:"production",
    withTransaction:async()=>{},
    healthCheck:async()=>({ok:true}),
  }),/backup/i);

  const adapter=validateTransactionalFinancialStoreAdapter({
    id:"pg-main",
    environment:"production",
    withTransaction:async(fn)=>fn({}),
    healthCheck:async()=>({ok:true}),
    createBackup:async()=>({id:"backup-1"}),
    verifyRestore:async()=>({ok:true}),
  });
  assert.equal(adapter.id,"pg-main");
});

test("secret custody boundary requires non-exportable signing and key rotation metadata",()=>{
  assert.throws(()=>validateSecretCustodyAdapter({
    providerId:"kms-1",
    environment:"production",
    exportSecret:async()=>Buffer.from("bad"),
    signDigest:async()=>Buffer.alloc(64),
    describeKey:async()=>({}),
  }),/export/i);

  const adapter=validateSecretCustodyAdapter({
    providerId:"kms-1",
    environment:"production",
    signDigest:async()=>Buffer.alloc(64),
    describeKey:async()=>({keyId:"key-1",exportable:false,rotationEnabled:true}),
    rotateKey:async()=>({keyId:"key-2"}),
  });
  assert.equal(adapter.providerId,"kms-1");
});

test("recovery evidence requires recent restore proof plus bounded RPO and RTO",()=>{
  assert.throws(()=>validateRecoveryEvidence({
    status:"approved",
    backupReference:"backup:daily",
    restoreTestReference:"restore:old",
    restoreTestedAt:"2026-01-01T00:00:00Z",
    reviewedAt:"2026-09-27T07:00:00Z",
    rpoMinutes:60,
    rtoMinutes:120,
  },{now:"2026-09-27T07:00:00Z"}),/recent/i);

  const result=validateRecoveryEvidence({
    status:"approved",
    backupReference:"backup:daily",
    restoreTestReference:"restore:2026-09-20",
    restoreTestedAt:"2026-09-20T07:00:00Z",
    reviewedAt:"2026-09-27T07:00:00Z",
    rpoMinutes:15,
    rtoMinutes:60,
  },{now:"2026-09-27T07:00:00Z"});
  assert.equal(result.rpoMinutes,15);
});

test("financial case operations cover fraud disputes returns and complaints without holding raw PII",()=>{
  const result=validateFinancialCaseOperations({
    fraud:approved("runbook:fraud"),
    disputes:approved("runbook:disputes"),
    returns:approved("runbook:returns"),
    complaints:approved("runbook:complaints"),
    caseRetention:approved("policy:case-retention"),
  });
  assert.equal(result.ready,true);
  assert.equal("pii" in result,false);
});

test("provider onboarding certification requires operational and exit controls",()=>{
  const incomplete={
    providerAuthorization:approved("contract:sponsor"),
    securityReview:approved("review:security"),
    businessContinuity:approved("review:bcp"),
    incidentEscalation:approved("runbook:incident"),
    reconciliationTest:approved("test:reconciliation"),
  };
  const result=certifyFinancialProviderOnboarding(incomplete);
  assert.equal(result.certified,false);
  assert.match(result.blockers.join("\n"),/exitPlan/);

  const complete=certifyFinancialProviderOnboarding({
    ...incomplete,
    regulatoryScope:approved("legal:scope"),
    dataProtection:approved("review:data"),
    auditRights:approved("contract:audit"),
    exitPlan:approved("runbook:exit"),
  });
  assert.equal(complete.certified,true);
});

test("production readiness can become green but never authorizes live money in v1.0",()=>{
  const readiness=evaluateFinancialProductionReadiness({
    regulatedReadiness:{ready:true,executionEnabled:false,blockers:[]},
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
      caseRetention:approved("policy:case-retention"),
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
    now:"2026-09-27T07:00:00Z",
  });

  assert.equal(readiness.ready,true);
  assert.equal(readiness.activationAllowed,false);
  assert.equal(readiness.externalRailsEnabled,false);
  assert.deepEqual(readiness.blockers,[]);
});
