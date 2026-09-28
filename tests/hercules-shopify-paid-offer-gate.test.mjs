import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");

test("paid launch requires Shopify Founding Access disposition evidence",()=>{
  assert.match(gate,/shopify-hercules-paid-offer-reconciled/);
  assert.match(gate,/SHOPIFY_TITAN_PRODUCT_ID/);
  assert.match(gate,/aligned_to_approved_offer/);
  assert.match(gate,/excluded_from_paid_launch/);
  assert.match(gate,/priceCadenceVerified/);
  assert.match(gate,/entitlementVerified/);
  assert.match(gate,/refundCancellationVerified/);
  assert.match(gate,/deliveryVerified/);
  assert.match(gate,/purchaseExposureBlocked/);
  assert.match(gate,/approvalPacketVersion/);
  assert.match(gate,/storefront_offer_reconciled/);
});

test("commercialOk fails closed until Shopify offer reconciliation is verified",()=>{
  assert.match(gate,/shopifyOfferReconciled/);
  assert.match(gate,/paymentProviderReady&&paymentPathVerified&&shopifyOfferReconciled/);
});
