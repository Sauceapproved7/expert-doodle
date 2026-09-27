import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  HerculesComplianceOperations,
  validateComplianceProviderAdapter,
} from "../hercules-bank/compliance-operations.mjs";

test("compliance evidence persists without storing document bodies or provider secrets",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-compliance-"));
  const statePath=join(root,"compliance.json");
  try{
    const first=await HerculesComplianceOperations.open({statePath});
    await first.recordEvidence({
      control:"amlProgram",
      status:"approved",
      reference:"policy:aml-v1",
      reviewedAt:"2026-09-27T06:00:00Z",
      actorId:"owner-1",
      ignoredDocumentBody:"must-not-persist",
    });
    await first.setProviderProfile({
      id:"provider-contract-001",
      environment:"production",
      endpoint:"https://provider.example.test",
      capabilities:["external_money_movement","custodial_deposits"],
      apiKey:"must-not-persist",
    });

    const reopened=await HerculesComplianceOperations.open({statePath});
    const summary=reopened.summary({
      mode:"production",
      jurisdiction:"US-CT",
      programType:"deposit_program",
    });
    assert.equal(summary.evidence.amlProgram.reference,"policy:aml-v1");
    assert.equal(summary.provider.id,"provider-contract-001");
    assert.equal(summary.executionEnabled,false);

    const raw=await readFile(statePath,"utf8");
    assert.equal(raw.includes("must-not-persist"),false);
    assert.equal(raw.includes("apiKey"),false);
    assert.equal(raw.includes("ignoredDocumentBody"),false);
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("tampering with durable compliance event history fails closed",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-compliance-"));
  const statePath=join(root,"compliance.json");
  try{
    const ops=await HerculesComplianceOperations.open({statePath});
    await ops.recordEvidence({
      control:"legalReview",
      status:"approved",
      reference:"legal:scope-1",
      reviewedAt:"2026-09-27T06:00:00Z",
      actorId:"owner-1",
    });
    const snapshot=JSON.parse(await readFile(statePath,"utf8"));
    snapshot.events[0].reference="legal:tampered";
    await writeFile(statePath,JSON.stringify(snapshot));

    await assert.rejects(
      ()=>HerculesComplianceOperations.open({statePath}),
      /integrity|hash/i,
    );
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("reconciliation operation persists summary only and stays fail-closed",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-compliance-"));
  try{
    const ops=await HerculesComplianceOperations.open({statePath:join(root,"compliance.json")});
    const report=await ops.recordReconciliation({
      actorId:"owner-1",
      runId:"recon-001",
      internal:[
        {reference:"a",amountMinor:1000,currency:"USD"},
        {reference:"b",amountMinor:2000,currency:"USD"},
      ],
      provider:[
        {reference:"a",amountMinor:1000,currency:"USD"},
        {reference:"b",amountMinor:2500,currency:"USD"},
      ],
    });
    assert.equal(report.ok,false);
    assert.equal(report.amountMismatchCount,1);

    const snapshot=ops.snapshot();
    assert.equal(snapshot.reconciliations.length,1);
    assert.equal("internal" in snapshot.reconciliations[0],false);
    assert.equal("provider" in snapshot.reconciliations[0],false);
    assert.equal(snapshot.reconciliations[0].executionEnabled,false);
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("compliance provider adapter requires production HTTPS and bounded KYC AML functions",()=>{
  assert.throws(()=>validateComplianceProviderAdapter({
    providerId:"kyc-provider",
    environment:"production",
    endpoint:"http://provider.example.test",
    verifyCustomer:async()=>({status:"clear"}),
    screenSanctions:async()=>({status:"clear"}),
    assessTransaction:async()=>({status:"clear"}),
  }),/HTTPS/i);

  const adapter=validateComplianceProviderAdapter({
    providerId:"kyc-provider",
    environment:"production",
    endpoint:"https://provider.example.test",
    verifyCustomer:async()=>({status:"clear"}),
    screenSanctions:async()=>({status:"clear"}),
    assessTransaction:async()=>({status:"clear"}),
  });
  assert.equal(adapter.providerId,"kyc-provider");
});
