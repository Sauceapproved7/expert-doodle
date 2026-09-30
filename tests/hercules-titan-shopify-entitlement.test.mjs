import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const webhook=readFileSync(new URL("../supabase/functions/hercules-private-bridge/studio-commerce-webhook.ts",import.meta.url),"utf8");
const launch=readFileSync(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const titanAccess=readFileSync(new URL("../supabase/functions/hercules-launch/titan-access.ts",import.meta.url),"utf8");

test("Titan Shopify paid orders create a claimable entitlement instead of gift-only state",()=>{
  assert.match(webhook,/HERCULES-TITAN-FOUNDING/);
  assert.match(webhook,/titan-shopify-founding-access-v1/);
  assert.match(webhook,/hercules_studio_purchase_entitlements/);
  assert.match(webhook,/product_code:TITAN_SHOPIFY_PRODUCT\.productCode/);
  assert.match(webhook,/status:'paid_pending_claim'/);
});

test("Titan entitlement claim is isolated from Studio and bound to verified email",()=>{
  assert.match(titanAccess,/auth\.getUser/);
  assert.match(titanAccess,/buyer_email_sha256/);
  assert.match(titanAccess,/hercules_claim_titan_purchase/);
  assert.match(titanAccess,/hercules-titan-founding-access/);
  assert.match(titanAccess,/titan-shopify-founding-access-v1/);
  assert.match(titanAccess,/founder_organization_forbidden/);
});

test("Hercules launch exposes the secure Titan claim handoff",()=>{
  assert.match(launch,/isTitanAccessPage/);
  assert.match(launch,/titanAccessPage/);
  assert.match(launch,/titan_access_request/);
  assert.match(launch,/titan_purchase_claim/);
});
