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
