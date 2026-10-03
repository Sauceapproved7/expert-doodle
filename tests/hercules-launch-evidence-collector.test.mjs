import test from "node:test";
import assert from "node:assert/strict";
import {collectLaunchEvidence} from "../hercules-runtime/hercules-launch-evidence-collector.mjs";

test("collector requires independently verified transport and paid-order receipts",()=>{
  const e=collectLaunchEvidence({
    transport:{authorized:true,source:"shopify_signed_or_native"},
    paidOrder:{verified:true,signatureVerified:true,reconciled:true},
    refund:{verified:true,revocationObserved:true},
    payout:{verified:true,providerLive:true,payoutsEnabled:true}
  });
  assert.equal(e.shopify.transportAuthorized,true);
  assert.equal(e.shopify.paidOrderObserved,true);
  assert.equal(e.refund.verified,true);
  assert.equal(e.payout.verified,true);
});

test("collector fails closed on partial or label-only evidence",()=>{
  const e=collectLaunchEvidence({
    transport:{authorized:"active"},
    paidOrder:{verified:true,signatureVerified:false,reconciled:true},
    refund:{verified:true,revocationObserved:false},
    payout:{verified:true,providerLive:true,payoutsEnabled:false}
  });
  assert.deepEqual(e,{
    shopify:{transportAuthorized:false,paidOrderObserved:false},
    refund:{verified:false},
    payout:{verified:false}
  });
});

test("collector never treats provider capability alone as transaction proof",()=>{
  const e=collectLaunchEvidence({
    transport:{authorized:true,source:"shopify_signed_or_native"},
    payout:{verified:true,providerLive:true,payoutsEnabled:true}
  });
  assert.equal(e.shopify.paidOrderObserved,false);
  assert.equal(e.refund.verified,false);
  assert.equal(e.payout.verified,true);
});
