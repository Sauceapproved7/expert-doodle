import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(new URL("../supabase/migrations/20260928101500_hercules_software_payment_path_v1.sql",import.meta.url),"utf8");
const provider=await readFile(new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),"utf8");
const webhook=await readFile(new URL("../supabase/functions/hercules-stripe-webhook/index.ts",import.meta.url),"utf8");

test("software billing state is isolated from the Hercules platform subscription tables",()=>{
  assert.match(migration,/hercules_software_stripe_catalog/);
  assert.match(migration,/hercules_software_subscriptions/);
  assert.match(migration,/hercules_software_entitlements/);
  assert.match(migration,/hercules_software_payment_verification_runs/);
  assert.match(migration,/primary key \(organization_id,product_code\)/);
  assert.match(migration,/primary key \(organization_id,product_code,feature_key\)/);
  assert.match(migration,/foreign key \(product_code,plan_code\)/);
});

test("Stripe software catalog is product-scoped to Studio and Ads exact monthly prices",()=>{
  assert.match(provider,/ensureSoftwareStripeCatalog/);
  assert.match(provider,/hercules_software_product_plans/);
  assert.match(provider,/hercules_software_commercial_approvals/);
  assert.match(provider,/sauceapproved-studio/);
  assert.match(provider,/sauceapproved-ads/);
  assert.match(provider,/candidate_monthly_price_cents/);
  assert.match(provider,/softwareProductCode/);
  assert.match(provider,/softwarePlanCode/);
  assert.match(provider,/hercules_software_stripe_catalog/);
  assert.match(provider,/2900/);
  assert.match(provider,/7900/);
  assert.match(provider,/19900/);
});

test("software Stripe catalog never marks the payment path verified",()=>{
  const block=provider.slice(provider.indexOf("async function ensureSoftwareStripeCatalog"));
  assert.doesNotMatch(block,/payment_path_verified[^\n]*true/);
  assert.doesNotMatch(block,/hercules_activate_software_checkout/);
});

test("Stripe webhook routes software lifecycle events to software subscriptions and entitlements",()=>{
  assert.match(webhook,/softwareProductCode/);
  assert.match(webhook,/softwarePlanCode/);
  assert.match(webhook,/hercules_software_subscriptions/);
  assert.match(webhook,/hercules_software_entitlements/);
  assert.match(webhook,/hercules_software_payment_verification_runs/);
  assert.match(webhook,/checkout\.session\.completed/);
  assert.match(webhook,/customer\.subscription\.created/);
  assert.match(webhook,/customer\.subscription\.updated/);
  assert.match(webhook,/customer\.subscription\.deleted/);
  assert.match(webhook,/invoice\.payment_succeeded/);
  assert.match(webhook,/charge\.refunded/);
});

test("payment provider stays dormant until owner packet and Stripe provider gates are approved",()=>{
  assert.match(provider,/pricing/);
  assert.match(provider,/terms/);
  assert.match(provider,/privacy/);
  assert.match(provider,/payment_provider_ready/);
  assert.match(provider,/owner_approvals_required/);
  assert.match(provider,/stripe_provider_required/);
});

test("payment provider prepares checkout without charging and cannot self-approve the paid path",()=>{
  assert.match(provider,/prepare_software_payment_verification/);
  assert.match(provider,/mode.*subscription/s);
  assert.match(provider,/payment_method_collection/);
  assert.match(provider,/success_url/);
  assert.match(provider,/cancel_url/);
  assert.match(provider,/verificationRunId/);
  assert.doesNotMatch(provider,/payment_path_verified[^\n]*true/);
  assert.doesNotMatch(provider,/hercules_activate_software_checkout/);
});

test("payment path certification requires verified checkout subscription invoice cancel and refund evidence",()=>{
  assert.match(migration,/hercules_software_certify_payment_path/);
  for(const event of [
    "checkout.session.completed",
    "customer.subscription.created",
    "invoice.payment_succeeded",
    "customer.subscription.deleted",
    "charge.refunded"
  ]) assert.match(migration,new RegExp(event.replaceAll(".","\\.")));
  assert.match(migration,/payment_path_verified/);
  assert.match(migration,/hercules_activate_software_checkout/);
  assert.match(migration,/service_role_required/);
});


test("paid software entitlements expand inherited Starter and Pro capabilities",()=>{
  assert.match(webhook,/resolved_entitlements/);
  assert.match(webhook,/starter_features/);
  assert.match(webhook,/pro_features/);
  assert.match(webhook,/new Set\(resolved\)/);
});
