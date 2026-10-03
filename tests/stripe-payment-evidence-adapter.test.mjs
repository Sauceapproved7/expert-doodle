import test from "node:test";
import assert from "node:assert/strict";
import {buildStripePaymentEvidenceSnapshot} from "../hercules-runtime/stripe-payment-evidence-adapter.mjs";

const NOW=new Date("2026-10-03T10:45:00.000Z");
const provenance={source:"stripe-live-connector",fingerprint:"sha256:acct_live_evidence_123"};

function completeObservation(overrides={}){
  return {
    observedAt:"2026-10-03T10:44:00.000Z",
    provenance,
    expected:{accountId:"acct_live",amountCents:4900,currency:"usd"},
    account:{
      id:"acct_live",
      livemode:true,
      chargesEnabled:true,
      payoutsEnabled:true
    },
    checkout:{
      accountId:"acct_live",
      livemode:true,
      sessionId:"cs_live_1",
      status:"complete",
      paymentStatus:"paid",
      amountTotal:4900,
      currency:"usd",
      paymentIntentId:"pi_live_1",
      chargeId:"ch_live_1",
      balanceTransactionId:"txn_live_1"
    },
    refund:{
      accountId:"acct_live",
      livemode:true,
      id:"re_live_1",
      status:"succeeded",
      amount:4900,
      currency:"usd",
      paymentIntentId:"pi_live_1",
      chargeId:"ch_live_1"
    },
    balanceTransaction:{
      accountId:"acct_live",
      livemode:true,
      id:"txn_live_1",
      source:"ch_live_1",
      type:"charge",
      currency:"usd",
      amount:4900,
      availableOn:1791026400
    },
    ...overrides
  };
}

test("builds complete DA-27 proof only from fresh independently matching live Stripe evidence",()=>{
  const snapshot=buildStripePaymentEvidenceSnapshot(completeObservation(),{now:NOW});
  assert.deepEqual(snapshot,{
    liveAuthorized:true,
    providerReady:true,
    evidenceFresh:true,
    provenance,
    paymentProof:{checkout:true,refund:true,payout:true}
  });
});

test("provider readiness alone never becomes payment proof",()=>{
  const observation=completeObservation({checkout:null,refund:null,balanceTransaction:null});
  const snapshot=buildStripePaymentEvidenceSnapshot(observation,{now:NOW});
  assert.equal(snapshot.liveAuthorized,true);
  assert.equal(snapshot.providerReady,true);
  assert.deepEqual(snapshot.paymentProof,{checkout:false,refund:false,payout:false});
});

test("checkout proof fails closed on test mode, amount drift, currency drift, or account mismatch",()=>{
  for(const checkout of [
    {...completeObservation().checkout,livemode:false},
    {...completeObservation().checkout,amountTotal:4800},
    {...completeObservation().checkout,currency:"eur"},
    {...completeObservation().checkout,accountId:"acct_other"}
  ]){
    const snapshot=buildStripePaymentEvidenceSnapshot(completeObservation({checkout}),{now:NOW});
    assert.equal(snapshot.paymentProof.checkout,false);
  }
});

test("refund proof must be succeeded, full-value, and bound to the verified payment",()=>{
  for(const refund of [
    {...completeObservation().refund,status:"pending"},
    {...completeObservation().refund,amount:100},
    {...completeObservation().refund,paymentIntentId:"pi_other"},
    {...completeObservation().refund,chargeId:"ch_other"}
  ]){
    const snapshot=buildStripePaymentEvidenceSnapshot(completeObservation({refund}),{now:NOW});
    assert.equal(snapshot.paymentProof.refund,false);
  }
});

test("payout proof means verified payout/balance state and must bind to the paid charge",()=>{
  for(const balanceTransaction of [
    {...completeObservation().balanceTransaction,id:"txn_other"},
    {...completeObservation().balanceTransaction,source:"ch_other"},
    {...completeObservation().balanceTransaction,currency:"eur"},
    {...completeObservation().balanceTransaction,livemode:false}
  ]){
    const snapshot=buildStripePaymentEvidenceSnapshot(completeObservation({balanceTransaction}),{now:NOW});
    assert.equal(snapshot.paymentProof.payout,false);
  }
  const notPayoutReady=completeObservation({
    account:{...completeObservation().account,payoutsEnabled:false}
  });
  assert.equal(buildStripePaymentEvidenceSnapshot(notPayoutReady,{now:NOW}).paymentProof.payout,false);
});

test("stale or future evidence fails freshness without inventing an owner action",()=>{
  const stale=buildStripePaymentEvidenceSnapshot(
    completeObservation({observedAt:"2026-10-03T10:30:00.000Z"}),
    {now:NOW,maxAgeMs:5*60*1000}
  );
  assert.equal(stale.evidenceFresh,false);

  const future=buildStripePaymentEvidenceSnapshot(
    completeObservation({observedAt:"2026-10-03T10:50:00.000Z"}),
    {now:NOW,maxFutureSkewMs:60*1000}
  );
  assert.equal(future.evidenceFresh,false);
});

test("credential-shaped input is rejected so the adapter remains credential-free",()=>{
  assert.throws(
    ()=>buildStripePaymentEvidenceSnapshot(
      {...completeObservation(),secretKey:"sk_live_should_never_enter_adapter"},
      {now:NOW}
    ),
    /credential_shaped_input_rejected/
  );
});
