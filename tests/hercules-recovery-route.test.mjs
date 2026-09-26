import test from "node:test";
import assert from "node:assert/strict";
import {planRecoveryRoute} from "../hercules-recovery/recovery-route.mjs";

const ready={schema:"hercules.recovery.assessment.v1",state:"RECOVERY_READY",priorityScore:70,confidence:"MEDIUM",safeToContact:true,reasonCodes:["OVERDUE"],nextAction:{type:"PERSONALIZED_FOLLOW_UP",requiresApproval:true},evidenceSha256:"a".repeat(64)};
const graph={schema:"hercules.recovery.graph.v1",evidenceSha256:"b".repeat(64),metrics:{verifiedEventCount:3,unverifiedEventCount:0,paidInvoiceCount:2,brokenPromiseCount:0,openDisputeCount:0,averageVerifiedPaidDaysAfterDue:5},reasonCodes:["VERIFIED_PAYMENT_HISTORY"],guardrails:{escalationAllowed:false,adverseDecisionEvidenceSufficient:false,requiresCurrentInvoiceAssessment:true,unverifiedEventsMayDriveAdverseAction:false}};

test("ready invoice with clean verified history proposes owner-approved follow-up",()=>{
 const route=planRecoveryRoute({assessment:ready,graph});
 assert.equal(route.route,"OWNER_APPROVED_FOLLOW_UP");
 assert.equal(route.executionAllowed,false);
 assert.equal(route.requiresApproval,true);
 assert.deepEqual(route.bindings,{assessmentSha256:"a".repeat(64),graphSha256:"b".repeat(64)});
});

test("blocked current assessment always overrides historical graph",()=>{
 const blocked={...ready,state:"DISPUTED",safeToContact:false,nextAction:{type:"HUMAN_REVIEW",requiresApproval:true}};
 const route=planRecoveryRoute({assessment:blocked,graph});
 assert.equal(route.route,"HUMAN_REVIEW");
 assert.equal(route.executionAllowed,false);
});

test("broken promise history cannot autonomously escalate",()=>{
 const risky={...graph,metrics:{...graph.metrics,brokenPromiseCount:2},reasonCodes:["VERIFIED_BROKEN_PROMISE_HISTORY"]};
 const route=planRecoveryRoute({assessment:ready,graph:risky});
 assert.equal(route.route,"OWNER_REVIEW_BEFORE_CONTACT");
 assert.equal(route.executionAllowed,false);
 assert.ok(route.reasonCodes.includes("VERIFIED_BROKEN_PROMISE_HISTORY"));
});

test("unverified observations force explanation but not adverse escalation",()=>{
 const uncertain={...graph,metrics:{...graph.metrics,unverifiedEventCount:2},reasonCodes:["UNVERIFIED_OBSERVATIONS_PRESENT"]};
 const route=planRecoveryRoute({assessment:ready,graph:uncertain});
 assert.equal(route.route,"OWNER_REVIEW_BEFORE_CONTACT");
 assert.equal(route.executionAllowed,false);
 assert.ok(route.reasonCodes.includes("UNVERIFIED_HISTORY_REQUIRES_REVIEW"));
});

test("invalid evidence bindings fail closed",()=>{
 assert.throws(()=>planRecoveryRoute({assessment:{...ready,evidenceSha256:"bad"},graph}),/assessment evidence binding/);
});
