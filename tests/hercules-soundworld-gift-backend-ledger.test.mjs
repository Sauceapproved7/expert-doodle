import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const migration=readFileSync(resolve(root,"supabase/migrations/20260930015000_hercules_soundworld_gift_ledger_v1.sql"),"utf8");
const studioPilotLaunchWindowPatch=readFileSync(resolve(root,"supabase/migrations/20260930195500_soundworld_studio_pilot_launch_window_v1.sql"),"utf8");
const fn=readFileSync(resolve(root,"supabase/functions/hercules-launch-gift/index.ts"),"utf8");
const stripeWebhook=readFileSync(resolve(root,"supabase/functions/hercules-stripe-webhook/index.ts"),"utf8");
const shopifyWebhook=readFileSync(resolve(root,"supabase/functions/hercules-private-bridge/studio-commerce-webhook.ts"),"utf8");
const privateBridge=readFileSync(resolve(root,"supabase/functions/hercules-private-bridge/index.ts"),"utf8");
const bridgeGift=readFileSync(resolve(root,"supabase/functions/hercules-private-bridge/soundworld-launch-gift.ts"),"utf8");
const launchGiftAccess=readFileSync(resolve(root,"supabase/functions/hercules-launch/soundworld-gift-access.ts"),"utf8");
const launchIndex=readFileSync(resolve(root,"supabase/functions/hercules-launch/index.ts"),"utf8");

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

test("SoundWorld window can open from the independently approved Studio Founding Pilot launch",()=>{
  assert.match(studioPilotLaunchWindowPatch,/sauceapproved-studio-founding-pilot/);
  assert.match(studioPilotLaunchWindowPatch,/hercules_studio_pilot_checkout_readiness/);
  assert.match(studioPilotLaunchWindowPatch,/checkout_enabled/);
  assert.match(studioPilotLaunchWindowPatch,/payment_launch_capability/);
  assert.match(studioPilotLaunchWindowPatch,/legacy_launch_gate/);
  assert.match(studioPilotLaunchWindowPatch,/studio_pilot_launch_gate/);
  assert.match(studioPilotLaunchWindowPatch,/paid_launch_gate_not_ready_or_stale/);
});

test("launch window requires a fresh launch-ready check",()=>{
  assert.match(migration,/checked_at >= now\(\) - interval '15 minutes'/i);
  assert.match(migration,/paid_launch_gate_not_ready_or_stale/);
});


test("pending launch-window ledger row satisfies non-null verification timestamp",()=>{
  assert.match(migration,/governance\/hercules-soundworld-launch-gift-v1\.json',\s*now\(\),\s*now\(\)/s);
  assert.doesNotMatch(migration,/governance\/hercules-soundworld-launch-gift-v1\.json',\s*null,/s);
});


test("private bridge multiplexes authenticated gift claims without a new Edge Function",()=>{
  assert.match(privateBridge,/soundworld-launch-gift\.ts/);
  assert.match(privateBridge,/isSoundWorldLaunchGiftRequest/);
  assert.match(privateBridge,/handleSoundWorldLaunchGiftRequest/);
  assert.match(bridgeGift,/auth\.getUser/);
  assert.match(bridgeGift,/hercules_soundworld_claim_gift/);
  assert.match(bridgeGift,/hercules_soundworld_gift_eligibility/);
});


test("buyer claim page uses secure magic-link auth and live private-bridge ledger",()=>{
  assert.match(launchIndex,/soundworld-gift-access\.ts/);
  assert.match(launchIndex,/isSoundWorldGiftAccessPage/);
  assert.match(launchGiftAccess,/signInWithOtp/);
  assert.match(launchGiftAccess,/soundworld_launch_gift=1/);
  assert.match(launchGiftAccess,/session\.access_token/);
  assert.match(launchGiftAccess,/soundworld-pods/);
  assert.match(launchGiftAccess,/soundworld-max/);
  assert.match(launchGiftAccess,/soundworld-portable-speaker/);
  assert.match(bridgeGift,/https:\/\/xbwuablxhhwsaoomsoco\.supabase\.co/);
});
