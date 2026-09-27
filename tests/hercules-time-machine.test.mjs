import test from "node:test";
import assert from "node:assert/strict";
import {createRestorePoint,planRecovery,verifyRestorePoint} from "../hercules-time-machine/time-machine.mjs";

const base=()=>({action:{type:"repository.update",target:"repo:file"},authorization:{evidenceSha256:"a".repeat(64)},before:{sha256:"b".repeat(64),state:"v1"},after:{sha256:"c".repeat(64),state:"v2"},recovery:{type:"ROLLBACK",target:"v1",verified:true},dependencies:["repo:file"]});

test("same normalized state creates same restore digest",()=>{const a=createRestorePoint(base()),b=createRestorePoint({...base(),dependencies:["repo:file"]});assert.equal(a.restorePointSha256,b.restorePointSha256);assert.equal(verifyRestorePoint(a).valid,true)});
test("rollback plan stays non-executing",()=>{const p=planRecovery(createRestorePoint(base()));assert.equal(p.mode,"ROLLBACK");assert.equal(p.executionAuthority,false);assert.equal(p.requiresApproval,true)});
test("compensation is never represented as rollback",()=>{const i=base();i.recovery={type:"COMPENSATE",target:"issue-credit",verified:true};const p=planRecovery(createRestorePoint(i));assert.equal(p.mode,"COMPENSATE");assert.equal(p.requiresApproval,true)});
test("unverified recovery fails to manual review",()=>{const i=base();i.recovery.verified=false;const p=planRecovery(createRestorePoint(i));assert.equal(p.mode,"MANUAL_ONLY");assert.ok(p.reasonCodes.includes("UNVERIFIED_RECOVERY"))});
test("manual-only remains manual-only",()=>{const i=base();i.recovery={type:"MANUAL_ONLY",target:"operator",verified:true};assert.equal(planRecovery(createRestorePoint(i)).mode,"MANUAL_ONLY")});
test("tampering is detected",()=>{const r=createRestorePoint(base());r.before.state="changed";assert.equal(verifyRestorePoint(r).valid,false)});
