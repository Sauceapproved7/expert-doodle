import test from "node:test";
import assert from "node:assert/strict";
import {assessRecoveryCase} from "../hercules-recovery/recovery-core.mjs";

test("disputed invoices fail closed to human review",()=>{
  const result=assessRecoveryCase({
    invoiceId:"inv-1",
    amountCents:125000,
    daysOverdue:45,
    dispute:{open:true,reason:"scope disagreement"},
    promiseToPay:null,
    contact:{doNotContact:false,lastResponseDaysAgo:3},
    paymentEvidence:{matched:false},
  });
  assert.equal(result.state,"DISPUTED");
  assert.equal(result.nextAction.type,"HUMAN_REVIEW");
  assert.equal(result.nextAction.requiresApproval,true);
  assert.equal(result.safeToContact,false);
});

test("verified payment evidence closes recovery action",()=>{
  const result=assessRecoveryCase({
    invoiceId:"inv-2",
    amountCents:78000,
    daysOverdue:22,
    dispute:{open:false},
    promiseToPay:null,
    contact:{doNotContact:false,lastResponseDaysAgo:7},
    paymentEvidence:{matched:true,matchedAmountCents:78000},
  });
  assert.equal(result.state,"PAID_EVIDENCE");
  assert.equal(result.nextAction.type,"NONE");
  assert.equal(result.safeToContact,false);
});

test("active promise to pay is protected from premature escalation",()=>{
  const result=assessRecoveryCase({
    invoiceId:"inv-3",
    amountCents:240000,
    daysOverdue:61,
    dispute:{open:false},
    promiseToPay:{status:"active",dueInDays:4},
    contact:{doNotContact:false,lastResponseDaysAgo:1},
    paymentEvidence:{matched:false},
  });
  assert.equal(result.state,"PROMISE_ACTIVE");
  assert.equal(result.nextAction.type,"WAIT_FOR_PROMISE");
  assert.equal(result.safeToContact,false);
});

test("overdue clean invoice gets deterministic prioritized follow-up",()=>{
  const input={
    invoiceId:"inv-4",
    amountCents:350000,
    daysOverdue:37,
    dispute:{open:false},
    promiseToPay:null,
    contact:{doNotContact:false,lastResponseDaysAgo:14},
    paymentEvidence:{matched:false},
  };
  const a=assessRecoveryCase(input);
  const b=assessRecoveryCase(input);
  assert.deepEqual(a,b);
  assert.equal(a.state,"RECOVERY_READY");
  assert.equal(a.nextAction.type,"PERSONALIZED_FOLLOW_UP");
  assert.equal(a.nextAction.requiresApproval,true);
  assert.equal(a.safeToContact,true);
  assert.ok(a.priorityScore>=0&&a.priorityScore<=100);
  assert.ok(a.reasonCodes.includes("OVERDUE"));
  assert.ok(a.reasonCodes.includes("HIGH_BALANCE"));
});

test("do-not-contact always suppresses outreach",()=>{
  const result=assessRecoveryCase({
    invoiceId:"inv-5",
    amountCents:99000,
    daysOverdue:90,
    dispute:{open:false},
    promiseToPay:null,
    contact:{doNotContact:true,lastResponseDaysAgo:30},
    paymentEvidence:{matched:false},
  });
  assert.equal(result.state,"CONTACT_BLOCKED");
  assert.equal(result.nextAction.type,"HUMAN_REVIEW");
  assert.equal(result.safeToContact,false);
});
