export function evaluateLaunchFinisher(input={}){
  const transportAuthorized=input.transportAuthorized===true;
  const paidOrderObserved=input.paidOrderObserved===true;
  const refundVerified=input.refundVerified===true;
  const payoutVerified=input.payoutVerified===true;
  const remaining=[];
  if(!transportAuthorized)remaining.push("shopify_transport");
  if(!paidOrderObserved)remaining.push("paid_order");
  if(!refundVerified)remaining.push("refund_reversal");
  if(!payoutVerified)remaining.push("payout");
  return Object.freeze({
    unlockEligible:remaining.length===0,
    commerceEnabled:false,
    remaining:Object.freeze(remaining),
    requiresOwnerPurchase:false,
    zeroOwnerSpend:input.zeroOwnerSpend===true
  });
}
