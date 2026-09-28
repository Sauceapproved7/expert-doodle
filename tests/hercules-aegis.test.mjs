import test from "node:test";
import assert from "node:assert/strict";
import { classifyThreat, buildContainmentPlan } from "../hercules-aegis/aegis.mjs";

test("benign traffic stays on the real service",()=>{
  const verdict=classifyThreat({failedAuth:0,scanBreadth:0,requestBurst:3,honeytokenTouched:false,knownBadIndicator:false});
  assert.equal(verdict.level,"normal");
  assert.equal(buildContainmentPlan(verdict).mode,"observe");
});

test("multi-signal hostile behavior is diverted into the Mirage Fabric",()=>{
  const verdict=classifyThreat({failedAuth:9,scanBreadth:18,requestBurst:140,honeytokenTouched:true,knownBadIndicator:false});
  const plan=buildContainmentPlan(verdict);
  assert.equal(verdict.level,"hostile");
  assert.equal(plan.mode,"mirage");
  assert.equal(plan.realAssetAccess,false);
  assert.equal(plan.outboundCounterattack,false);
  assert.ok(plan.controls.includes("ephemeral-decoy-surface"));
  assert.ok(plan.controls.includes("honeytoken-telemetry"));
});

test("a single weak signal does not trigger containment",()=>{
  const verdict=classifyThreat({failedAuth:2,scanBreadth:0,requestBurst:0,honeytokenTouched:false,knownBadIndicator:false});
  assert.notEqual(verdict.level,"hostile");
});

test("known-bad indicators fail closed into containment without hack-back",()=>{
  const verdict=classifyThreat({failedAuth:0,scanBreadth:0,requestBurst:0,honeytokenTouched:false,knownBadIndicator:true});
  const plan=buildContainmentPlan(verdict);
  assert.equal(plan.mode,"mirage");
  assert.equal(plan.realAssetAccess,false);
  assert.equal(plan.outboundCounterattack,false);
});
