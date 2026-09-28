import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const offer=JSON.parse(readFileSync(new URL("../governance/hercules-titan-founding-access-offer-v1.json",import.meta.url),"utf8"));
const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");

test("Titan Founding Access is a separate one-time offer and not Revenue Recovery subscription pricing",()=>{
  assert.equal(offer.packet_version,"hercules-titan-founding-access-offer-v1");
  assert.equal(offer.product_code,"hercules-titan-founding-access");
  assert.equal(offer.shopify.product_id,"gid://shopify/Product/10261114782016");
  assert.equal(offer.billing.model,"one_time");
  assert.equal(offer.billing.candidate_price_cents,4900);
  assert.equal(offer.billing.currency,"USD");
  assert.equal(offer.billing.owner_approval_required,true);
  assert.equal(offer.relationships.revenue_recovery_subscription_included,false);
  assert.equal(offer.activation.checkout_enabled,false);
  assert.equal(offer.activation.public_paid_launch_open,false);
});

test("Titan unresolved commercial terms remain explicitly owner-pending",()=>{
  assert.equal(offer.owner_decisions.price_and_cadence,"pending");
  assert.equal(offer.owner_decisions.entitlement,"pending");
  assert.equal(offer.owner_decisions.refund_and_cancellation,"pending");
  assert.equal(offer.owner_decisions.delivery,"pending");
  assert.equal(offer.owner_decisions.terms,"pending");
  assert.equal(offer.owner_decisions.privacy,"pending");
});

test("Shopify reconciliation is bound to the Titan offer packet instead of Revenue Recovery launch packet",()=>{
  assert.match(gate,/TITAN_OFFER_PACKET_VERSION='hercules-titan-founding-access-offer-v1'/);
  assert.match(gate,/TITAN_OFFER_PACKET_DIGEST='8e9330f7cf70103e8fd8691cdd14a22d70eb466849c1b5a5fc98bc45c378a00f'/);
  assert.match(gate,/shopifyOfferValue\?\.approvalPacketVersion===TITAN_OFFER_PACKET_VERSION/);
  assert.match(gate,/shopifyOfferValue\?\.approvalPacketDigest===TITAN_OFFER_PACKET_DIGEST/);
  assert.doesNotMatch(gate,/shopifyOfferValue\?\.approvalPacketVersion===LAUNCH_PACKET_VERSION/);
});
