import test from "node:test";
import assert from "node:assert/strict";
import {buildRecoveryGraph} from "../hercules-recovery/recovery-graph.mjs";

test("graph deterministically summarizes verified relationship history",()=>{
  const input={accountId:"acct-1",events:[
    {eventId:"e1",type:"INVOICE_PAID",occurredAt:"2026-01-10T00:00:00.000Z",invoiceId:"i1",daysAfterDue:3,amountCents:100000,verified:true},
    {eventId:"e2",type:"PROMISE_BROKEN",occurredAt:"2026-02-12T00:00:00.000Z",invoiceId:"i2",verified:true},
    {eventId:"e3",type:"DISPUTE_OPENED",occurredAt:"2026-03-01T00:00:00.000Z",invoiceId:"i3",verified:true},
  ]};
  assert.deepEqual(buildRecoveryGraph(input),buildRecoveryGraph(input));
  const graph=buildRecoveryGraph(input);
  assert.equal(graph.metrics.verifiedEventCount,3);
  assert.equal(graph.metrics.brokenPromiseCount,1);
  assert.equal(graph.metrics.openDisputeCount,1);
  assert.equal(graph.guardrails.escalationAllowed,false);
  assert.ok(graph.reasonCodes.includes("OPEN_DISPUTE_HISTORY"));
});

test("unverified events are retained as observations but cannot drive adverse action",()=>{
  const graph=buildRecoveryGraph({accountId:"acct-2",events:[
    {eventId:"u1",type:"PROMISE_BROKEN",occurredAt:"2026-01-01T00:00:00.000Z",invoiceId:"i1",verified:false},
  ]});
  assert.equal(graph.metrics.verifiedEventCount,0);
  assert.equal(graph.metrics.unverifiedEventCount,1);
  assert.equal(graph.metrics.brokenPromiseCount,0);
  assert.equal(graph.guardrails.adverseDecisionEvidenceSufficient,false);
});

test("duplicate event identity fails closed",()=>{
  assert.throws(()=>buildRecoveryGraph({accountId:"acct-3",events:[
    {eventId:"dup",type:"INVOICE_PAID",occurredAt:"2026-01-01T00:00:00.000Z",verified:true},
    {eventId:"dup",type:"INVOICE_PAID",occurredAt:"2026-01-02T00:00:00.000Z",verified:true},
  ]}),/duplicate eventId/);
});

test("graph exposes behavior facts rather than a credit or collectability score",()=>{
  const graph=buildRecoveryGraph({accountId:"acct-4",events:[]});
  assert.equal("creditScore" in graph,false);
  assert.equal("collectabilityScore" in graph,false);
  assert.equal("recoveryProbability" in graph,false);
  assert.equal(graph.guardrails.adverseDecisionEvidenceSufficient,false);
});
