import test from "node:test";
import assert from "node:assert/strict";
import {createMarketing16DeployBridge} from "../hercules-deploy/marketing-16-bridge.mjs";

test("marketing 16 deploy bridge exposes the merged runtime through a read-only deployer boundary",()=>{
  const bridge=createMarketing16DeployBridge();
  const health=bridge.health();
  assert.equal(health.ok,true);
  assert.equal(health.service,"hercules-marketing-16");
  assert.equal(health.modules,16);
  assert.equal(health.deployerConnected,true);
  assert.equal(health.autoPublish,false);
  assert.equal(health.autoSpend,false);
  assert.equal(health.storefrontMutation,false);
});

test("marketing 16 deploy bridge plans all 16 modules without releasing mutations",()=>{
  const bridge=createMarketing16DeployBridge();
  const plan=bridge.plan({brandId:"sauceapproved",objective:"grow verified revenue",evidenceIds:["proof-1"]});
  assert.equal(plan.actions.length,16);
  assert.equal(plan.releaseReady,false);
  assert.ok(plan.actions.every(action=>action.requiresExplicitReleaseAuthorization));
});

test("marketing 16 deploy bridge rejects mutation-shaped operations",()=>{
  const bridge=createMarketing16DeployBridge();
  assert.throws(()=>bridge.execute("publish",{}),/marketing_operation_not_allowed/);
});
