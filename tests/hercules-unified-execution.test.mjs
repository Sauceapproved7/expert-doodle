import test from "node:test";
import assert from "node:assert/strict";
import {createProofObject} from "../hercules-proof/proof-object.mjs";
import {createConsequenceEnvelope} from "../hercules-consequence/consequence-envelope.mjs";
import {bindProofToConsequence} from "../hercules-proof/proof-consequence-binding.mjs";
import {createRestorePoint} from "../hercules-time-machine/time-machine.mjs";
import {createExecutionLifecycle,verifyExecutionLifecycle} from "../hercules-runtime/execution-lifecycle.mjs";

const auth="a".repeat(64);
function fixture(){
 const proof=createProofObject({intent:{id:"job-1"},authorization:{evidenceSha256:auth},execution:{status:"PROPOSED"},verification:{status:"PENDING"},artifact:{},ownership:{holder:"Sauceapproved7"},rollback:{status:"PLANNED"}});
 const consequence=createConsequenceEnvelope({action:{type:"repository.update",target:"repo:file"},authority:{maxImpact:"RESOURCE",evidenceSha256:auth},effects:[{resource:"repo:file",impact:"RESOURCE",reversibility:"ROLLBACK",verified:true}],uncertainty:[]});
 const binding=bindProofToConsequence({proof,consequence});
 const restore=createRestorePoint({action:{type:"repository.update",target:"repo:file"},authorization:{evidenceSha256:auth},before:{sha256:"b".repeat(64),state:"v1"},after:{sha256:"c".repeat(64),state:"v2"},recovery:{type:"ROLLBACK",target:"v1",verified:true},dependencies:["repo:file"]});
 return {intent:{id:"job-1"},authorization:{evidenceSha256:auth},proof,consequence,binding,restore};
}

test("clean evidence yields an approval-gated ready lifecycle",()=>{const x=createExecutionLifecycle(fixture());assert.equal(x.state,"READY_FOR_AUTHORIZED_EXECUTION");assert.equal(x.executionAuthority,false);assert.equal(x.requiresApproval,true);assert.equal(verifyExecutionLifecycle(x).valid,true)});
test("human-review consequence fails closed",()=>{const f=fixture();f.consequence=createConsequenceEnvelope({action:{type:"repository.update",target:"repo:file"},authority:{maxImpact:"RESOURCE",evidenceSha256:auth},effects:[{resource:"repo:file",impact:"RESOURCE",reversibility:"ROLLBACK",verified:false}],uncertainty:[]});f.binding=bindProofToConsequence({proof:f.proof,consequence:f.consequence});const x=createExecutionLifecycle(f);assert.equal(x.state,"HUMAN_REVIEW");assert.equal(x.executionAuthority,false)});
test("authorization evidence mismatch is rejected",()=>{const f=fixture();f.authorization.evidenceSha256="d".repeat(64);assert.throws(()=>createExecutionLifecycle(f),/authorization/i)});
test("tampered restore point blocks readiness",()=>{const f=fixture();f.restore.before.state="tampered";const x=createExecutionLifecycle(f);assert.equal(x.state,"HUMAN_REVIEW");assert.ok(x.reasonCodes.includes("INVALID_RESTORE_POINT"))});
