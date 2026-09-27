import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateRegulatedMoneyReadiness,
  validateRegulatedProviderAdapter,
  reconcileExternalSettlements,
  HerculesRegulatedRailBoundary,
} from "../hercules-bank/regulatory-boundary.mjs";

const approved=(reference)=>({status:"approved",reference,reviewedAt:"2026-09-27T00:00:00Z"});

function readyConfig(overrides={}){
  return {
    mode:"production",
    jurisdiction:"US-CT",
    programType:"deposit_program",
    provider:{
      id:"provider-contract-001",
      environment:"production",
      endpoint:"https://provider.example.test",
      capabilities:["external_money_movement","custodial_deposits"],
    },
    controls:{
      partnerAuthorization:approved("contract:partner-bank"),
      jurisdictionAuthorization:approved("legal:ct-scope"),
      identityVerification:approved("policy:cip-kyc-kyb"),
      amlProgram:approved("policy:aml"),
      sanctionsScreening:approved("policy:sanctions"),
      transactionMonitoring:approved("policy:monitoring"),
      reconciliation:approved("runbook:daily-recon"),
      disputes:approved("runbook:disputes"),
      incidentResponse:approved("runbook:financial-ir"),
      dataRetention:approved("policy:financial-retention"),
      legalReview:approved("legal:launch-opinion"),
      custodialOwnershipRecords:approved("controls:fbo-recordkeeping"),
      insuranceDisclosureReview:approved("legal:deposit-disclosures"),
    },
    ...overrides,
  };
}

test("regulated money remains blocked until every required control has review evidence",()=>{
  const config=readyConfig();
  delete config.controls.partnerAuthorization;

  const result=evaluateRegulatedMoneyReadiness(config);

  assert.equal(result.ready,false);
  assert.match(result.blockers.join("\n"),/partnerAuthorization/);
});

test("boolean flags cannot substitute for reviewed compliance evidence",()=>{
  const config=readyConfig();
  config.controls.amlProgram=true;

  const result=evaluateRegulatedMoneyReadiness(config);

  assert.equal(result.ready,false);
  assert.match(result.blockers.join("\n"),/amlProgram/);
});

test("deposit program requires custodial ownership records and insurance disclosure review",()=>{
  const config=readyConfig();
  delete config.controls.custodialOwnershipRecords;
  delete config.controls.insuranceDisclosureReview;

  const result=evaluateRegulatedMoneyReadiness(config);

  assert.equal(result.ready,false);
  assert.match(result.blockers.join("\n"),/custodialOwnershipRecords/);
  assert.match(result.blockers.join("\n"),/insuranceDisclosureReview/);
});

test("complete reviewed control set can become readiness-green without enabling execution",()=>{
  const result=evaluateRegulatedMoneyReadiness(readyConfig());

  assert.equal(result.ready,true);
  assert.equal(result.executionEnabled,false);
  assert.deepEqual(result.blockers,[]);
});

test("provider adapter validation requires production HTTPS and a bounded contract",()=>{
  assert.throws(
    ()=>validateRegulatedProviderAdapter({
      providerId:"p1",
      environment:"production",
      endpoint:"http://provider.example.test",
      submitTransfer:async()=>{},
      fetchTransfer:async()=>{},
      listSettlementRecords:async()=>[],
    }),
    /https/i,
  );

  const adapter=validateRegulatedProviderAdapter({
    providerId:"p1",
    environment:"production",
    endpoint:"https://provider.example.test",
    submitTransfer:async()=>({id:"x"}),
    fetchTransfer:async()=>({id:"x"}),
    listSettlementRecords:async()=>[],
  });
  assert.equal(adapter.providerId,"p1");
});

test("settlement reconciliation detects missing, duplicate, and amount-mismatched provider records",()=>{
  const report=reconcileExternalSettlements({
    internal:[
      {reference:"a",amountMinor:1000,currency:"USD"},
      {reference:"b",amountMinor:2500,currency:"USD"},
      {reference:"c",amountMinor:3000,currency:"USD"},
    ],
    provider:[
      {reference:"a",amountMinor:1000,currency:"USD"},
      {reference:"b",amountMinor:2600,currency:"USD"},
      {reference:"c",amountMinor:3000,currency:"USD"},
      {reference:"c",amountMinor:3000,currency:"USD"},
    ],
  });

  assert.equal(report.ok,false);
  assert.deepEqual(report.amountMismatches.map((x)=>x.reference),["b"]);
  assert.deepEqual(report.duplicates.map((x)=>x.reference),["c"]);
});

test("regulated rail boundary prepares but never executes live money in v0.8",async()=>{
  const adapter=validateRegulatedProviderAdapter({
    providerId:"p1",
    environment:"production",
    endpoint:"https://provider.example.test",
    submitTransfer:async()=>{throw new Error("must not be called");},
    fetchTransfer:async()=>({}),
    listSettlementRecords:async()=>[],
  });
  const boundary=new HerculesRegulatedRailBoundary({
    readiness:readyConfig(),
    adapter,
  });

  const prepared=boundary.prepareTransfer({
    fromAccountId:"acct_customer_1",
    amountMinor:1250,
    currency:"USD",
    rail:"ACH",
    destinationToken:"provider-tokenized-destination",
  });

  assert.equal(prepared.executionAllowed,false);
  assert.equal(prepared.amountMinor,1250);
  await assert.rejects(
    ()=>boundary.executeTransfer(prepared),
    /live_rail_execution_locked/,
  );
});
