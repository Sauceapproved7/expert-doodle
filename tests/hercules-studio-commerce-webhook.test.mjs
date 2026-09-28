import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const webhook=await readFile(new URL("../supabase/functions/hercules-private-bridge/studio-commerce-webhook.ts",import.meta.url),"utf8");
const access=await readFile(new URL("../supabase/functions/hercules-launch/studio-access.ts",import.meta.url),"utf8");

test("Shopify webhook requires single-purpose credential and Shopify delivery headers",()=>{
  assert.match(webhook,/studio-shopify-orders-paid/);
  assert.match(webhook,/x-shopify-shop-domain/i);
  assert.match(webhook,/x-shopify-topic/i);
  assert.match(webhook,/x-shopify-webhook-id/i);
  assert.match(webhook,/safeEqual/);
  assert.match(webhook,/shopify_webhook_unauthorized/);
});

test("webhook stores only an email hash in the entitlement ledger",()=>{
  assert.match(webhook,/buyer_email_sha256/);
  assert.match(webhook,/SHA-256/);
  assert.doesNotMatch(webhook,/buyer_email\s*:/);
  assert.match(webhook,/hercules_studio_purchase_entitlements/);
});

test("webhook is idempotent by delivery id and entitlement fingerprint",()=>{
  assert.match(webhook,/hercules_studio_shopify_webhook_events/);
  assert.match(webhook,/webhook_id_payload_conflict/);
  assert.match(webhook,/entitlement_key/);
  assert.match(webhook,/ignoreDuplicates/);
});

test("paid callback never creates a user or organization directly",()=>{
  assert.doesNotMatch(webhook,/auth\.admin/);
  assert.doesNotMatch(webhook,/hercules_organizations.*insert/s);
  assert.doesNotMatch(webhook,/hercules_memberships.*insert/s);
});

test("Studio claim requires an authenticated user and matching verified email hash",()=>{
  assert.match(access,/auth\.getUser/);
  assert.match(access,/buyer_email_sha256/);
  assert.match(access,/hercules_studio_purchase_entitlements/);
  assert.match(access,/paid_pending_claim/);
  assert.match(access,/email_entitlement_mismatch/);
});

test("Studio claim creates an isolated organization and refuses founder-org reuse",()=>{
  assert.match(access,/hercules_organizations/);
  assert.match(access,/hercules_memberships/);
  assert.match(access,/sauceapproved/);
  assert.match(access,/founder_organization_forbidden/);
  assert.match(access,/studio-shopify-founding-pilot-v1/);
});
