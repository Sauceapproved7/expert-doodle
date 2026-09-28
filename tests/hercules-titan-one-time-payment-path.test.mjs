import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,"..");
const migrations=resolve(repo,"supabase/migrations");
const migrationName=readdirSync(migrations).find(x=>x.includes("hercules_titan_payment_path_v1"));
const provider=readFileSync(resolve(repo,"supabase/functions/hercules-provider-connect/index.ts"),"utf8");
const webhook=readFileSync(resolve(repo,"supabase/functions/hercules-stripe-webhook/index.ts"),"utf8");
const ui=readFileSync(resolve(repo,"supabase/functions/hercules-integrations/index.ts"),"utf8");

test("Titan has a separate one-time live verification schema",()=>{
  assert.ok(migrationName,"Titan payment path migration missing");
  const sql=readFileSync(resolve(migrations,migrationName),"utf8");
  assert.match(sql,/hercules_titan_payment_verification_runs/);
  assert.match(sql,/hercules_titan_payment_verification_events/);
  assert.match(sql,/expected_amount_cents/);
  assert.match(sql,/4900/);
  assert.match(sql,/checkout\.session\.completed/);
  assert.match(sql,/charge\.refunded/);
  assert.match(sql,/titan\.payout_state_verified/);
  assert.match(sql,/hercules_titan_certify_payment_path/);
  assert.match(sql,/payment_path_verified/);
  assert.match(sql,/paid-billing-path-verified/);
  assert.doesNotMatch(sql,/customer\.subscription/);
  assert.doesNotMatch(sql,/hercules_activate_software_checkout/);
});

test("Titan Stripe catalog is one-time and cannot reuse recurring software prices",()=>{
  assert.match(provider,/ensureTitanStripeCatalog/);
  assert.match(provider,/TITAN_PRICE_CENTS=4900/);
  assert.match(provider,/titan_founding_access_one_time_v1/);
  assert.match(provider,/recurring/);
  const block=provider.slice(provider.indexOf("async function ensureTitanStripeCatalog"),provider.indexOf("async function activeStripeConnection"));
  assert.doesNotMatch(block,/recurring\[interval\]/);
  assert.match(block,/unit_amount/);
  assert.match(block,/currency/);
});

test("Titan verification checkout is owner-only and mode payment",()=>{
  const block=provider.slice(provider.indexOf("if(action==='prepare_titan_payment_verification')"),provider.indexOf("if(action==='reconcile_titan_payment_verification')"));
  assert.ok(block.length>0);
  assert.match(block,/role\)!=='owner'/);
  assert.match(block,/owner_approvals_required/);
  assert.match(block,/stripe_provider_required/);
  assert.match(block,/mode','payment'/);
  assert.match(block,/titanVerificationRunId/);
  assert.match(block,/charge_occurs_only_if_owner_completes_checkout/);
  assert.doesNotMatch(block,/subscription_data/);
  assert.doesNotMatch(block,/mode','subscription'/);
});

test("Titan reconciliation requires real payout state before certification",()=>{
  const block=provider.slice(provider.indexOf("if(action==='reconcile_titan_payment_verification')"),provider.indexOf("if(action==='configure_stripe')"));
  assert.ok(block.length>0);
  assert.match(block,/payouts_enabled/);
  assert.match(block,/charges_enabled/);
  assert.match(block,/balance_transactions/);
  assert.match(block,/titan\.payout_state_verified/);
  assert.match(block,/hercules_titan_certify_payment_path/);
});

test("Stripe webhook auto-refunds Titan verification without creating a subscription",()=>{
  assert.match(webhook,/titanVerificationRunId/);
  assert.match(webhook,/autoRefundTitanVerification/);
  assert.match(webhook,/hercules_titan_payment_verification_runs/);
  assert.match(webhook,/hercules_titan_payment_verification_events/);
  assert.match(webhook,/checkout\.session\.completed/);
  assert.match(webhook,/charge\.refunded/);
  const block=webhook.slice(webhook.indexOf("if(type==='checkout.session.completed')"),webhook.indexOf("if(['customer.subscription.created'"));
  assert.match(block,/titanVerificationRunId/);
  assert.doesNotMatch(block,/saveSoftwareSubscription[\s\S]*titanVerificationRunId/);
});

test("Owner Decision Center exposes Titan live verification but does not auto-charge",()=>{
  assert.match(ui,/Titan one-time payment verification/);
  assert.match(ui,/prepare_titan_payment_verification/);
  assert.match(ui,/reconcile_titan_payment_verification/);
  assert.match(ui,/Type exactly:/);
  assert.match(ui,/START TITAN \$49 LIVE VERIFICATION/);
  assert.doesNotMatch(ui,/prepare_titan_payment_verification[^\n]+START TITAN \$49 LIVE VERIFICATION/);
});
