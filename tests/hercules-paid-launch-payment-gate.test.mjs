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

test("owned AppDeploy Stripe custody prefers fresh live HTTPS attestation with ledger fallback",()=>{
  assert.match(gate,/APPDEPLOY_STRIPE_ATTESTATION_URL/);
  assert.match(gate,/\/api\/provider-attestation/);
  assert.match(gate,/fetch\(APPDEPLOY_STRIPE_ATTESTATION_URL/);
  assert.match(gate,/observedAt/);
  assert.match(gate,/5\*60\*1000/);
  assert.match(gate,/liveAppDeployStripeReady/);
  assert.match(gate,/ledgerAppDeployStripeReady/);
  assert.match(gate,/liveAppDeployStripeReady\|\|ledgerAppDeployStripeReady/);
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


test("launch gate reconciles its system-owned provider readiness approval from live provider evidence",()=>{
  assert.match(gate,/hercules_software_record_payment_gate/);
  assert.match(gate,/p_product_code:TITAN_PRODUCT_CODE/);
  assert.match(gate,/p_gate:'payment_provider_ready'/);
  assert.match(gate,/p_verified:paymentProviderReady/);
  assert.match(gate,/owner_approval_required:false/);
});


test("global launch gate accepts the approved Studio Pilot Shopify lane without owner self-purchase",()=>{
  assert.match(gate,/STUDIO_PILOT_PRODUCT_CODE/);
  assert.match(gate,/studioPilotOwnerApprovalsComplete/);
  assert.match(gate,/studioPilotProviderReady/);
  assert.match(gate,/studioPilotLaunchCapabilityReady/);
  assert.match(gate,/studioPilotStorefrontPublished/);
  assert.match(gate,/studioPilotPaidLaunchReady/);
  assert.match(gate,/postLaunchObservationRequired/);
  assert.match(gate,/first_real_customer_order/);
});

test("legacy Titan lane still requires verified live payment path",()=>{
  assert.match(gate,/legacyTitanPaidLaunchReady/);
  assert.match(gate,/paymentProviderReady&&paymentPathVerified&&shopifyOfferReconciled/);
});
