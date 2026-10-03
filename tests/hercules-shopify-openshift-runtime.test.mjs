import test from "node:test";
import assert from "node:assert/strict";
import { createApiHandler } from "../shopify/hercules/backend/api.mjs";
import { processJob } from "../shopify/hercules/backend/worker.mjs";
import { buildReconciliationPlan } from "../shopify/hercules/backend/reconciler-runner.mjs";

test("OpenShift Shopify API health is available while commerce stays disabled", async () => {
  const handler=createApiHandler({ commerceEnabled:false });
  const res=await handler(new Request("http://localhost/health"));
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,service:"hercules-shopify-api",commerceEnabled:false});
});

test("OpenShift Shopify API rejects mutation routes while commerce is disabled", async () => {
  const handler=createApiHandler({ commerceEnabled:false });
  const res=await handler(new Request("http://localhost/admin/graphql",{method:"POST"}));
  assert.equal(res.status,503);
  assert.deepEqual(await res.json(),{error:"commerce_disabled"});
});

test("worker refuses mutating jobs while commerce is disabled", async () => {
  const result=await processJob({type:"shopify_graphql_mutation",payload:{}},{commerceEnabled:false,executeMutation:async()=>{throw new Error("should_not_run");}});
  assert.deepEqual(result,{ok:false,status:"blocked",reason:"commerce_disabled"});
});

test("worker allows non-mutating verification jobs while commerce is disabled", async () => {
  const result=await processJob({type:"verify_config",payload:{shop:"sauceapproved-2.myshopify.com"}},{commerceEnabled:false,verifyConfig:async()=>({ok:true})});
  assert.deepEqual(result,{ok:true,status:"complete",result:{ok:true}});
});

test("reconciler produces a bounded dry-run plan without advancing watermark", () => {
  const plan=buildReconciliationPlan({shopDomain:"sauceapproved-2.myshopify.com",apiVersion:"2026-10",watermark:"2026-10-03T00:10:00.000Z",now:"2026-10-03T01:00:00.000Z",dryRun:true});
  assert.equal(plan.shopDomain,"sauceapproved-2.myshopify.com");
  assert.equal(plan.apiVersion,"2026-10");
  assert.equal(plan.dryRun,true);
  assert.equal(plan.advanceWatermark,false);
  assert.equal(plan.window.start,"2026-10-03T00:05:00.000Z");
  assert.equal(plan.window.end,"2026-10-03T01:00:00.000Z");
});
