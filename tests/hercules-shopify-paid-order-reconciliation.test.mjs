import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260930180500_hercules_shopify_paid_order_reconciliation_v1.sql",import.meta.url),
  "utf8"
);
const agents=await readFile(new URL("../AGENTS.md",import.meta.url),"utf8");
const policy=JSON.parse(await readFile(
  new URL("../governance/hercules-shopify-paid-order-reconciliation-v1.json",import.meta.url),
  "utf8"
));

test("reconciliation is exact-product and fail-closed",()=>{
  assert.match(sql,/sauceapproved-2\.myshopify\.com/);
  assert.match(sql,/SA-STUDIO-PILOT-001/);
  assert.match(sql,/HERCULES-TITAN-FOUNDING/);
  assert.match(sql,/payment_not_settled/);
  assert.match(sql,/test_order_not_eligible/);
  assert.match(sql,/cancelled_order_not_eligible/);
  assert.match(sql,/buyer_email_sha256_invalid/);
  assert.match(sql,/line_item_not_eligible/);
});

test("reconciliation is idempotent and preserves hashed buyer identity",()=>{
  assert.match(sql,/on conflict \(shop_domain,provider_order_id,variant_id,sku\) do nothing/i);
  assert.match(sql,/buyer_email_sha256/);
  assert.doesNotMatch(sql,/buyer_email[^_]/i);
});

test("SoundWorld eligibility is recorded only through the existing launch-window function",()=>{
  assert.match(sql,/hercules_soundworld_record_purchase_eligibility/);
  assert.match(sql,/p_verification_purchase\s*=>\s*false/);
  assert.match(sql,/p_payment_settled\s*=>\s*true/);
});

test("runner contract points to the bounded reconciliation policy",()=>{
  assert.match(agents,/hercules-shopify-paid-order-reconciliation-v1\.json/);
  assert.equal(policy.schema,"sauceapproved.hercules.shopify-paid-order-reconciliation");
  assert.equal(policy.version,1);
  assert.equal(policy.sourceOfTruth,"connected_shopify_admin_api");
  assert.equal(policy.allowCustomerSuppliedPaymentClaims,false);
  assert.equal(policy.allowLegalApprovalChanges,false);
  assert.equal(policy.allowPriceChanges,false);
  assert.equal(policy.allowCheckoutPublication,false);
});
