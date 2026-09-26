import test from "node:test";
import assert from "node:assert/strict";
import {createConsequenceEnvelope, verifyConsequenceEnvelope} from "../hercules-consequence/consequence-envelope.mjs";

const base={action:{type:"repository.update",target:"repo:file"},authority:{maxImpact:"RESOURCE",evidenceSha256:"a".repeat(64)},effects:[{resource:"repo:file",impact:"RESOURCE",reversibility:"ROLLBACK",verified:true}],uncertainty:[]};

test("same normalized proposal yields same envelope digest",()=>{const a=createConsequenceEnvelope(base),b=createConsequenceEnvelope({uncertainty:[],effects:[...base.effects],authority:{...base.authority},action:{...base.action}});assert.equal(a.envelopeSha256,b.envelopeSha256)});
test("impact above authority ceiling fails closed",()=>assert.throws(()=>createConsequenceEnvelope({...base,effects:[{resource:"production",impact:"SYSTEM",reversibility:"MANUAL_ONLY",verified:true}]}),/authority ceiling/i));
test("unverified effects cannot produce executable authority",()=>{const e=createConsequenceEnvelope({...base,effects:[{resource:"repo:file",impact:"RESOURCE",reversibility:"ROLLBACK",verified:false}]});assert.equal(e.executionAuthority,false);assert.equal(e.disposition,"HUMAN_REVIEW");assert.ok(e.reasonCodes.includes("UNVERIFIED_EFFECT"))});
test("irreversible effects require human review",()=>{const e=createConsequenceEnvelope({...base,effects:[{resource:"external:email",impact:"RESOURCE",reversibility:"COMPENSATE",verified:true}]});assert.equal(e.disposition,"HUMAN_REVIEW");assert.ok(e.reasonCodes.includes("COMPENSATION_REQUIRED"))});
test("tampering is detected",()=>{const e=createConsequenceEnvelope(base);e.effects[0].resource="other";assert.equal(verifyConsequenceEnvelope(e).valid,false)});
