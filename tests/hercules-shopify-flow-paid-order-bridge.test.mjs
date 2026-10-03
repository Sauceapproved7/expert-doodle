import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const webhook=await readFile(new URL("../supabase/functions/hercules-shopify-webhook/index.ts",import.meta.url),"utf8");

test("signed Shopify Flow orders/paid bridge reconciles through the existing fail-closed RPC",()=>{
  assert.match(webhook,/orders\/paid/);
  assert.match(webhook,/hercules_reconcile_verified_shopify_paid_order_v1/);
  assert.match(webhook,/connected_shopify_flow/);
  assert.match(webhook,/payment_settled/);
  assert.match(webhook,/test/);
  assert.match(webhook,/cancelled/);
  assert.doesNotMatch(webhook,/COMMERCE_ENABLED\s*=\s*true/);
});

test("Shopify Flow bridge keeps token, freshness, nonce, and canonical-shop protections",()=>{
  assert.match(webhook,/hercules_bridge_token_valid/);
  assert.match(webhook,/x-hercules-timestamp/);
  assert.match(webhook,/x-hercules-nonce/);
  assert.match(webhook,/shopDomainAllowed/);
});
