import test from "node:test";
import assert from "node:assert/strict";
import {createRecoveryProductCase,verifyRecoveryProductCase} from "../hercules-recovery/customer-case.mjs";

const base=()=>({
 invoice:{invoiceId:"inv-1",accountId:"acct-1",amountCents:125000,daysOverdue:35,contact:{lastResponseDaysAgo:20}},
 history:[{eventId:"e1",type:"CONTACT_RESPONSE",occurredAt:"2026-08-01T00:00:00Z",verified:true}]
});

test("clean overdue case becomes owner-approved follow-up",()=>{const c=createRecoveryProductCase(base());assert.equal(c.route,"OWNER_APPROVED_FOLLOW_UP");assert.equal(c.requiresApproval,true);assert.equal(c.executionAuthority,false);assert.equal(verifyRecoveryProductCase(c).valid,true)});
test("open dispute becomes human review",()=>{const i=base();i.invoice.dispute={open:true};const c=createRecoveryProductCase(i);assert.equal(c.route,"HUMAN_REVIEW");assert.equal(c.safeToContact,false)});
test("paid evidence becomes no action",()=>{const i=base();i.invoice.paymentEvidence={matched:true,matchedAmountCents:125000};const c=createRecoveryProductCase(i);assert.equal(c.route,"NO_ACTION");assert.equal(c.requiresApproval,false)});
test("unverified history prevents direct follow-up route",()=>{const i=base();i.history.push({eventId:"e2",type:"PROMISE_BROKEN",occurredAt:"2026-08-02T00:00:00Z",verified:false});const c=createRecoveryProductCase(i);assert.equal(c.route,"OWNER_REVIEW_BEFORE_CONTACT")});
test("product case exposes no recovery probability or credit score",()=>{const c=createRecoveryProductCase(base());assert.equal("recoveryProbability" in c,false);assert.equal("creditScore" in c,false);assert.equal("collectabilityScore" in c,false)});
test("tampering is detected",()=>{const c=createRecoveryProductCase(base());c.route="NO_ACTION";assert.equal(verifyRecoveryProductCase(c).valid,false)});
