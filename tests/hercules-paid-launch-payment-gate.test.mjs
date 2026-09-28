import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");

test("commercial launch preserves the active production Stripe Vault provider path",()=>{
  assert.match(gate,/hercules_provider_connections/);
  assert.match(gate,/eq\('provider','stripe'\)/);
  assert.match(gate,/eq\('status','active'\)/);
  assert.match(gate,/not\('access_secret_ref','is',null\)/);
  assert.match(gate,/not\('signing_secret_ref','is',null\)/);
  assert.match(gate,/metadata\?\.catalog_ready===true/);
  assert.match(gate,/metadata\?\.livemode===true/);
  assert.match(gate,/payment_provider_ready/);
});

test("owned AppDeploy Stripe custody requires a fresh credential-free live attestation",()=>{
  assert.match(gate,/appdeploy-stripe-provider-verified/);
  assert.match(gate,/APPDEPLOY_STRIPE_APP_ID/);
  assert.match(gate,/custody===['"]appdeploy['"]/);
  assert.match(gate,/credentialMode===['"]live['"]/);
  assert.match(gate,/stripeReachable===true/);
  assert.match(gate,/webhookConfigured===true/);
  assert.match(gate,/24\*60\*60\*1000/);
  assert.match(gate,/vaultStripeReady\|\|appDeployStripeReady/);
});

test("commercial launch requires checkout refund and payout evidence bound to the active custody path",()=>{
  assert.match(gate,/paid-billing-path-verified/);
  assert.match(gate,/paymentEvidenceBound/);
  assert.match(gate,/custody===['"]supabase-vault['"]/);
  assert.match(gate,/custody===['"]appdeploy['"]/);
  assert.match(gate,/checkoutVerified/);
  assert.match(gate,/refundVerified/);
  assert.match(gate,/payoutStateVerified/);
  assert.match(gate,/payment_path_verified/);
});

test("commercialOk fails closed unless payment provider and paid flow are both verified",()=>{
  assert.match(gate,/paymentProviderReady&&paymentPathVerified/);
});
