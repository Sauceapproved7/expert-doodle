import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");

test("AppDeploy attestation cannot act as Hercules catalog or pricing authority",()=>{
  assert.match(gate,/appDeployAttestationHasNoPricingAuthority/);
  assert.match(gate,/price|catalog/i);
  assert.match(gate,/liveAppDeployProviderValue/);
  assert.match(gate,/appDeployProviderValue/);
  assert.match(gate,/paymentProviderReady/);
});

test("AppDeploy remains optional provider-readiness evidence and commerce stays fail closed",()=>{
  assert.match(gate,/vaultStripeReady\|\|appDeployStripeReady/);
  assert.match(gate,/paymentProviderReady&&paymentPathVerified&&shopifyOfferReconciled/);
  assert.doesNotMatch(gate,/COMMERCE_ENABLED\s*=\s*true/);
});
