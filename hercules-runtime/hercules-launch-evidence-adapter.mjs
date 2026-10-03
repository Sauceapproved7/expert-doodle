function verified(value){return value===true;}

export function evidenceToLaunchInput(evidence={}){
  const shopify=evidence?.shopify??{};
  const refund=evidence?.refund??{};
  const payout=evidence?.payout??{};
  return Object.freeze({
    transportAuthorized:verified(shopify.transportAuthorized),
    paidOrderObserved:verified(shopify.paidOrderObserved),
    refundVerified:verified(refund.verified),
    payoutVerified:verified(payout.verified),
    zeroOwnerSpend:true
  });
}
