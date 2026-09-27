import test from "node:test";
import assert from "node:assert/strict";
import {createProofObject} from "../hercules-proof/proof-object.mjs";
import {createConsequenceEnvelope} from "../hercules-consequence/consequence-envelope.mjs";
import {bindProofToConsequence,verifyProofConsequenceBinding} from "../hercules-proof/proof-consequence-binding.mjs";

const proof=()=>createProofObject({intent:{id:"job-1"},authorization:{evidenceSha256:"a".repeat(64)},execution:{status:"PROPOSED"},verification:{status:"PENDING"},artifact:{},ownership:{holder:"Sauceapproved7"},rollback:{status:"AVAILABLE"}});
const envelope=()=>createConsequenceEnvelope({action:{type:"repository.update",target:"repo:file"},authority:{maxImpact:"RESOURCE",evidenceSha256:"a".repeat(64)},effects:[{resource:"repo:file",impact:"RESOURCE",reversibility:"ROLLBACK",verified:true}],uncertainty:[]});

test("binds independently verified proof and consequence digests",()=>{const b=bindProofToConsequence({proof:proof(),consequence:envelope()});assert.equal(b.schema,"hercules.proof.consequence.binding.v1");assert.equal(b.executionAuthority,false);assert.equal(verifyProofConsequenceBinding(b).valid,true)});
test("rejects tampered proof",()=>{const p=proof();p.intent.id="tampered";assert.throws(()=>bindProofToConsequence({proof:p,consequence:envelope()}),/proof/i)});
test("rejects tampered consequence envelope",()=>{const e=envelope();e.effects[0].resource="other";assert.throws(()=>bindProofToConsequence({proof:proof(),consequence:e}),/consequence/i)});
test("authority evidence must agree across both objects",()=>{const e=createConsequenceEnvelope({action:{type:"repository.update",target:"repo:file"},authority:{maxImpact:"RESOURCE",evidenceSha256:"b".repeat(64)},effects:[{resource:"repo:file",impact:"RESOURCE",reversibility:"ROLLBACK",verified:true}],uncertainty:[]});assert.throws(()=>bindProofToConsequence({proof:proof(),consequence:e}),/authorization evidence/i)});
