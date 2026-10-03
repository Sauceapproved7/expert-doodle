import test from "node:test";
import assert from "node:assert/strict";
import {createMarketing16Runtime} from "../sauceapproved-studio/marketing-16/runtime.mjs";

test("runtime health exposes the canonical suite without mutation authority",()=>{
  const runtime=createMarketing16Runtime();
  const health=runtime.health();
  assert.equal(health.ok,true);
  assert.equal(health.service,"hercules-marketing-16");
  assert.equal(health.modules,16);
  assert.equal(health.autoPublish,false);
  assert.equal(health.autoSpend,false);
  assert.equal(health.storefrontMutation,false);
});

test("runtime plan requires evidence and remains unreleased",()=>{
  const runtime=createMarketing16Runtime();
  const plan=runtime.plan({
    brandId:"sauceapproved",
    objective:"grow verified revenue",
    evidenceIds:["proof-1"]
  });
  assert.equal(plan.actions.length,16);
  assert.equal(plan.releaseReady,false);
  assert.ok(plan.actions.every(action=>action.requiresExplicitReleaseAuthorization));
});

test("runtime rejects unknown operations",()=>{
  const runtime=createMarketing16Runtime();
  assert.throws(()=>runtime.execute("publish",{}),/marketing_operation_not_allowed/);
});
