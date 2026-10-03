import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const runner=await readFile(new URL("../hercules-runtime/shopify-paid-order-runner.mjs",import.meta.url),"utf8");
const runtimePolicy=JSON.parse(await readFile(new URL("../hercules-runtime/shopify-paid-order-runner-policy.json",import.meta.url),"utf8"));

test("paid-order runner exists and is bounded by the canonical policy",()=>{
  assert.equal(runtimePolicy.lookbackHours,48);
  assert.equal(runtimePolicy.maxOrdersPerRun,50);
  assert.match(runner,/lookbackHours/);
  assert.match(runner,/maxOrdersPerRun/);
});
test("runner fails closed unless Shopify reports a settled paid non-test non-cancelled order",()=>{
  assert.match(runner,/financialStatus/i);assert.match(runner,/paid/i);assert.match(runner,/paymentSettled/);assert.match(runner,/test/);assert.match(runner,/cancelled/);
});
test("runner requires exact allowlisted product variant and SKU identity",()=>{
  assert.match(runner,/allowedProducts/);assert.match(runner,/productId/);assert.match(runner,/variantId/);assert.match(runner,/sku/);
});
test("runner hashes normalized buyer email and never sends raw email to reconciliation",()=>{
  assert.match(runner,/sha256/i);assert.match(runner,/trim\(\).*toLowerCase|toLowerCase\(\).*trim/i);assert.match(runner,/buyer_email_sha256/);assert.doesNotMatch(runner,/p_buyer_email\b/);
});
test("runner invokes only the existing reconciliation RPC and contains no commerce or webhook mutation",()=>{
  assert.match(runner,/hercules_reconcile_verified_shopify_paid_order_v1/);
  assert.doesNotMatch(runner,/COMMERCE_ENABLED\s*=\s*true/);
  assert.doesNotMatch(runner,/webhookSubscriptionCreate/);
});
