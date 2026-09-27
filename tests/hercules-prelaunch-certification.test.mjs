import test from "node:test";
import assert from "node:assert/strict";
import {createCustomerContext,evaluateCustomerAction} from "../hercules-runtime/customer-foundation.mjs";
import {createRecoveryProductCase} from "../hercules-recovery/customer-case.mjs";
import {createCommandRequest,routeCommand} from "../hercules-runtime/command-surface.mjs";
import {createProofObject} from "../hercules-proof/proof-object.mjs";
import {createConsequenceEnvelope} from "../hercules-consequence/consequence-envelope.mjs";
import {bindProofToConsequence} from "../hercules-proof/proof-consequence-binding.mjs";
import {createRestorePoint} from "../hercules-time-machine/time-machine.mjs";
import {createExecutionLifecycle} from "../hercules-runtime/execution-lifecycle.mjs";
import {evaluateLaunchHardening,REQUIRED_LAUNCH_CONTROLS} from "../hercules-runtime/launch-hardening.mjs";
import {evaluateProductionOpsReadiness,REQUIRED_PRODUCTION_EVIDENCE} from "../hercules-runtime/production-ops-readiness.mjs";

const auth="a".repeat(64), evidence="b".repeat(64);
const verified=(keys)=>Object.fromEntries(keys.map(k=>[k,{status:"VERIFIED",evidenceSha256:evidence}]));

test("synthetic first-customer journey reaches authorized-execution boundary without executing",()=>{
 const customer=createCustomerContext({user:{id:"synthetic-user"},workspace:{id:"synthetic-workspace"},membership:{role:"owner",evidenceSha256:"c".repeat(64)},identity:{evidenceSha256:"d".repeat(64)},plan:{id:"growth",features:["recovery"],monthlyActionLimit:100},usage:{monthlyActions:1}});
 assert.equal(evaluateCustomerAction(customer,{workspaceId:"synthetic-workspace",feature:"recovery",action:"publish"}).disposition,"CUSTOMER_BOUNDARY_SATISFIED");

 const recovery=createRecoveryProductCase({invoice:{invoiceId:"inv-cert-1",accountId:"acct-cert-1",amountCents:125000,daysOverdue:35,contact:{lastResponseDaysAgo:20}},history:[]});
 assert.equal(recovery.route,"OWNER_APPROVED_FOLLOW_UP");

 const command=createCommandRequest({intentId:"cert-job-1",capability:"recovery.route",payload:{caseSha256:recovery.caseSha256}});
 assert.equal(routeCommand(command).route,"hercules-recovery");

 const proof=createProofObject({intent:{id:"cert-job-1"},authorization:{evidenceSha256:auth},execution:{status:"PROPOSED"},verification:{status:"PENDING"},artifact:{caseSha256:recovery.caseSha256},ownership:{holder:"Sauceapproved7"},rollback:{status:"PLANNED"}});
 const consequence=createConsequenceEnvelope({action:{type:"recovery.follow_up",target:"inv-cert-1"},authority:{maxImpact:"RESOURCE",evidenceSha256:auth},effects:[{resource:"inv-cert-1",impact:"RESOURCE",reversibility:"ROLLBACK",verified:true}],uncertainty:[]});
 const binding=bindProofToConsequence({proof,consequence});
 const restore=createRestorePoint({action:{type:"recovery.follow_up",target:"inv-cert-1"},authorization:{evidenceSha256:auth},before:{sha256:"e".repeat(64),state:"pending"},after:{sha256:"f".repeat(64),state:"proposed"},recovery:{type:"ROLLBACK",target:"pending",verified:true},dependencies:["inv-cert-1"]});
 const lifecycle=createExecutionLifecycle({intent:{id:"cert-job-1"},authorization:{evidenceSha256:auth},proof,consequence,binding,restore});
 assert.equal(lifecycle.state,"READY_FOR_AUTHORIZED_EXECUTION");
 assert.equal(lifecycle.executionAuthority,false);
});

test("hardening gate accepts a complete synthetic evidence set but does not prove production",()=>{
 const result=evaluateLaunchHardening(verified(REQUIRED_LAUNCH_CONTROLS));
 assert.equal(result.readyForLaunch,true);
});

test("production gate remains blocked without real continuous production evidence",()=>{
 const result=evaluateProductionOpsReadiness({continuousTelemetry:false,evidence:{}});
 assert.equal(result.ready,false);
 assert.equal(result.disposition,"NOT_READY");
 assert.ok(result.reasonCodes.includes("CONTINUOUS_TELEMETRY_REQUIRED"));
});
