import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLaunchHardening,REQUIRED_LAUNCH_CONTROLS} from "../hercules-runtime/launch-hardening.mjs";

const verified=()=>Object.fromEntries(REQUIRED_LAUNCH_CONTROLS.map(k=>[k,{status:"VERIFIED",evidenceSha256:"a".repeat(64)}]));

test("all required verified controls can satisfy hardening gate",()=>{const r=evaluateLaunchHardening(verified());assert.equal(r.disposition,"HARDENING_VERIFIED");assert.equal(r.readyForLaunch,true);assert.equal(r.missing.length,0)});
test("missing evidence fails closed",()=>{const e=verified();delete e.recovery_drill;const r=evaluateLaunchHardening(e);assert.equal(r.readyForLaunch,false);assert.ok(r.missing.includes("recovery_drill"))});
test("failed control blocks launch",()=>{const e=verified();e.tenant_isolation={status:"FAILED",evidenceSha256:"b".repeat(64)};const r=evaluateLaunchHardening(e);assert.equal(r.readyForLaunch,false);assert.ok(r.failed.includes("tenant_isolation"))});
test("invalid evidence hash does not count as verified",()=>{const e=verified();e.security_scan={status:"VERIFIED",evidenceSha256:"nope"};const r=evaluateLaunchHardening(e);assert.equal(r.readyForLaunch,false);assert.ok(r.invalidEvidence.includes("security_scan"))});
test("unknown extra controls do not replace required controls",()=>{const e=verified();delete e.backup_restore;e.extra={status:"VERIFIED",evidenceSha256:"c".repeat(64)};assert.equal(evaluateLaunchHardening(e).readyForLaunch,false)});
