import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLaunchFinisher} from "../hercules-runtime/hercules-launch-finisher.mjs";

const base={transportAuthorized:false,paidOrderObserved:false,refundVerified:false,payoutVerified:false};

test("stays fail closed until every external proof exists",()=>{
  const r=evaluateLaunchFinisher(base);
  assert.equal(r.unlockEligible,false);
  assert.equal(r.commerceEnabled,false);
  assert.deepEqual(r.remaining,["shopify_transport","paid_order","refund_reversal","payout"]);
});

test("zero-owner-spend mode never requires a self purchase",()=>{
  const r=evaluateLaunchFinisher({...base,zeroOwnerSpend:true});
  assert.equal(r.requiresOwnerPurchase,false);
});

test("transport alone never unlocks commerce",()=>{
  const r=evaluateLaunchFinisher({...base,transportAuthorized:true});
  assert.equal(r.unlockEligible,false);
  assert.equal(r.commerceEnabled,false);
});

test("all genuine proofs make unlock eligible without enabling commerce itself",()=>{
  const r=evaluateLaunchFinisher({transportAuthorized:true,paidOrderObserved:true,refundVerified:true,payoutVerified:true,zeroOwnerSpend:true});
  assert.equal(r.unlockEligible,true);
  assert.equal(r.commerceEnabled,false);
  assert.deepEqual(r.remaining,[]);
  assert.equal(r.requiresOwnerPurchase,false);
});
