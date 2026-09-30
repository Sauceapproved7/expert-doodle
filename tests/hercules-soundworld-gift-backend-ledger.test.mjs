import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const migration=readFileSync(resolve(root,"supabase/migrations/20260930015000_hercules_soundworld_gift_ledger_v1.sql"),"utf8");
const fn=readFileSync(resolve(root,"supabase/functions/hercules-launch-gift/index.ts"),"utf8");
const stripeWebhook=readFileSync(resolve(root,"supabase/functions/hercules-stripe-webhook/index.ts"),"utf8");
const shopifyWebhook=readFileSync(resolve(root,"supabase/functions/hercules-private-bridge/studio-commerce-webhook.ts"),"utf8");

test("SoundWorld gift ledger is durable, RLS protected, and duplicate-safe",()=>{
  assert.match(migration,/hercules_soundworld_gift_eligibility/);
  assert.match(migration,/hercules_soundworld_gift_reservations/);
  assert.match(migration,/unique\s*\(purchase_key\)/i);
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all .* from anon, authenticated/is);
  assert.match(migration,/gift_already_reserved_for_purchase/);
});

test("promotion stays closed until a real paid-launch timestamp is recorded",()=>{
  assert.match(migration,/hercules-soundworld-launch-gift-window/);
  assert.match(migration,/status='active'/);
  assert.match(migration,/openedAt/);
  assert.match(migration,/interval '14 days'/i);
  assert.match(migration,/public_paid_launch_not_open/);
});

test("trusted purchase recorder excludes verification payments and unsettled charges",()=>{
  assert.match(migration,/hercules_soundworld_record_purchase_eligibility/);
  assert.match(migration,/verification_purchase_excluded/);
  assert.match(migration,/payment_not_settled/);
  assert.match(migration,/service_role_required/);
});

test("authenticated buyer claim endpoint binds claim to verified user identity",()=>{
  assert.match(fn,/auth\.getUser/);
  assert.match(fn,/hercules_soundworld_claim_gift/);
  assert.match(fn,/buyer_email_sha256/);
  assert.match(fn,/soundworld-pods/);
  assert.match(fn,/soundworld-max/);
  assert.match(fn,/soundworld-portable-speaker/);
});

test("Stripe and Shopify trusted purchase paths feed the same gift eligibility ledger",()=>{
  assert.match(stripeWebhook,/hercules_soundworld_record_purchase_eligibility/);
  assert.match(shopifyWebhook,/hercules_soundworld_record_purchase_eligibility/);
  assert.match(stripeWebhook,/verificationRunId/);
  assert.match(shopifyWebhook,/buyer_email_sha256/);
});


test("workspace membership alone cannot claim another buyer's gift",()=>{
  assert.doesNotMatch(migration,/from public\.hercules_memberships m[\s\S]*v_identity_ok/);
  assert.doesNotMatch(fn,/hercules_memberships/);
});

test("launch window requires a fresh launch-ready check",()=>{
  assert.match(migration,/checked_at >= now\(\) - interval '15 minutes'/i);
  assert.match(migration,/paid_launch_gate_not_ready_or_stale/);
});
