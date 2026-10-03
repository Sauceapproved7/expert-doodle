const yes=(v)=>v===true;

export function collectLaunchEvidence(source={}){
  const transport=source?.transport??{};
  const paidOrder=source?.paidOrder??{};
  const refund=source?.refund??{};
  const payout=source?.payout??{};

  const transportAuthorized=
    yes(transport.authorized)&&transport.source==="shopify_signed_or_native";

  const paidOrderObserved=
    transportAuthorized&&yes(paidOrder.verified)&&
    yes(paidOrder.signatureVerified)&&yes(paidOrder.reconciled);

  const refundVerified=
    yes(refund.verified)&&yes(refund.revocationObserved);

  const payoutVerified=
    yes(payout.verified)&&yes(payout.providerLive)&&yes(payout.payoutsEnabled);

  return Object.freeze({
    shopify:Object.freeze({transportAuthorized,paidOrderObserved}),
    refund:Object.freeze({verified:refundVerified}),
    payout:Object.freeze({verified:payoutVerified})
  });
}
