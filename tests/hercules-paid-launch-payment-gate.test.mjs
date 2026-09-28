import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");

test("commercial launch requires an active production Stripe provider",()=>{
  assert.match(gate,/hercules_provider_connections/);
  assert.match(gate,/eq\('provider','stripe'\)/);
  assert.match(gate,/eq\('status','active'\)/);
  assert.match(gate,/not\('access_secret_ref','is',null\)/);
  assert.match(gate,/not\('signing_secret_ref','is',null\)/);
  assert.match(gate,/metadata\?\.livemode===true/);
  assert.match(gate,/payment_provider_ready/);
});

test("commercial launch requires verified checkout refund and payout evidence",()=>{
  assert.match(gate,/paid-billing-path-verified/);
  assert.match(gate,/checkoutVerified/);
  assert.match(gate,/refundVerified/);
  assert.match(gate,/payoutStateVerified/);
  assert.match(gate,/payment_path_verified/);
});

test("commercialOk fails closed unless payment provider and paid flow are verified",()=>{
  assert.match(gate,/paymentProviderReady&&paymentPathVerified/);
});


test("commercial launch can use owned AppDeploy Stripe custody only with live account-bound redacted proof",()=>{
  assert.match(gate,/sauceapproved-hercules-titan-dhakbi\.v2\.appdeploy\.ai\/api\/billing\/config/);
  assert.match(gate,/credentialMode===['"]live['"]/);
  assert.match(gate,/stripeReachable===true/);
  assert.match(gate,/webhookConfigured===true/);
  assert.match(gate,/accountFingerprint/);
  assert.match(gate,/vaultStripeReady\|\|appDeployStripeReady/);
});

test("provider readiness keeps catalog verification separate and account-bound",()=>{
  assert.match(gate,/stripe-catalog-verified/);
  assert.match(gate,/catalogEvidenceValue\?\.accountFingerprint===providerAccountFingerprint/);
  assert.match(gate,/paymentProviderAuthorized&&catalogReady/);
});
