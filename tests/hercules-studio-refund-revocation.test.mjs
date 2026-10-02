import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const claim=fs.readFileSync("supabase/migrations/20260930045527_hercules_titan_shopify_entitlement_v1.sql","utf8");
const reconcile=fs.readFileSync("supabase/migrations/20260930195500_hercules_studio_first_sale_observation_v1.sql","utf8");
const revokePath="supabase/migrations/20261003010000_hercules_studio_refund_revocation_v1.sql";
const revoke=fs.existsSync(revokePath)?fs.readFileSync(revokePath,"utf8"):"";

test("Studio refund revocation implementation exists and is product-isolated",()=>{
  assert.match(revoke,/hercules_revoke_studio_purchase/);
  assert.match(revoke,/product_code\s*=\s*'sauceapproved-studio'/);
  assert.doesNotMatch(revoke,/update\s+public\.hercules_studio_purchase_entitlements[\s\S]*product_code\s*=\s*'hercules-titan-founding-access'/);
});

test("refund-before-claim leaves no claimable Studio entitlement",()=>{
  assert.match(revoke,/status\s*=\s*'revoked'/);
  assert.match(revoke,/revoked_at\s*=\s*v_now/);
  assert.match(claim,/status='paid_pending_claim'/);
});

test("refund-after-claim disables the membership bound to that entitlement organization",()=>{
  assert.match(revoke,/hercules_memberships/);
  assert.match(revoke,/status\s*=\s*'inactive'/);
  assert.match(revoke,/organization_id\s*=\s*v_ent\.organization_id/);
});

test("claim and refund serialize on the same entitlement row",()=>{
  assert.match(claim,/for update skip locked/);
  assert.match(revoke,/for update/);
  assert.match(revoke,/provider_order_id/);
});

test("replayed paid reconciliation cannot resurrect a revoked purchase",()=>{
  assert.match(reconcile,/on conflict \(shop_domain,provider_order_id,variant_id,sku\) do nothing/);
  assert.match(revoke,/status\s*=\s*'revoked'/);
  assert.doesNotMatch(reconcile,/do update[\s\S]*status\s*=\s*'paid_pending_claim'/);
});

test("revocation targets one provider purchase and does not revoke a separate valid purchase",()=>{
  assert.match(revoke,/provider_order_id\s*=\s*trim\(p_order_id\)/);
  assert.match(revoke,/variant_id\s*=\s*trim\(p_variant_id\)/);
  assert.match(revoke,/sku\s*=\s*trim\(p_sku\)/);
});
