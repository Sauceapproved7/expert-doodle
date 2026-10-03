const REQUIRED_EVIDENCE=["offerApproved","priceApproved","fulfillmentReady"];

function bool(value){ return value === true; }
function nonNegativeInt(value){ return Number.isInteger(value) && value >= 0 ? value : 0; }

export function evaluateRevenueOpportunity(offer){
  if(!offer || typeof offer !== "object") throw new TypeError("offer is required");
  const evidence=offer.evidence ?? {};
  const missing=[];
  if(!bool(evidence.offerApproved)) missing.push("OFFER_NOT_APPROVED");
  if(!bool(evidence.priceApproved)) missing.push("PRICE_NOT_APPROVED");
  if(!bool(evidence.fulfillmentReady)) missing.push("FULFILLMENT_NOT_READY");
  if(missing.length){
    return {id:offer.id,eligible:false,score:0,reasons:missing,executionAuthority:false};
  }

  const metrics=offer.metrics ?? {};
  let score=0;
  const reasons=[];
  if(offer.model === "subscription" && nonNegativeInt(metrics.monthlyRecurringRevenueCents) > 0){
    score+=30; reasons.push("RECURRING_REVENUE");
  }
  if(nonNegativeInt(metrics.customers) > 0){ score+=20; reasons.push("PROVEN_CUSTOMERS"); }
  if(nonNegativeInt(metrics.repeatCustomers) > 0){ score+=10; reasons.push("REPEAT_CUSTOMERS"); }
  if(bool(evidence.fulfillmentReady)){ score+=5; reasons.push("FULFILLMENT_READY"); }

  return {id:offer.id,eligible:true,score,reasons,executionAuthority:false};
}

export function canActivateCommerce(state={}){
  const blockers=[];
  if(!bool(state.commerceEnabledRequested)) blockers.push("COMMERCE_NOT_REQUESTED");
  if(!bool(state.checkoutVerified)) blockers.push("CHECKOUT_UNVERIFIED");
  if(!bool(state.refundVerified)) blockers.push("REFUND_UNVERIFIED");
  if(!bool(state.payoutVerified)) blockers.push("PAYOUT_UNVERIFIED");
  if(!bool(state.paidOrderTransportVerified)) blockers.push("PAID_ORDER_TRANSPORT_UNVERIFIED");
  if(!bool(state.legalApproved)) blockers.push("LEGAL_NOT_APPROVED");
  return {allowed:blockers.length===0,blockers,executionAuthority:false};
}

export function buildRevenuePortfolio(offers=[]){
  if(!Array.isArray(offers)) throw new TypeError("offers must be an array");
  const evaluated=offers.map(offer=>({
    id:offer.id,
    name:offer.name,
    model:offer.model,
    priceCents:nonNegativeInt(offer.priceCents),
    ...evaluateRevenueOpportunity(offer),
  })).sort((a,b)=>b.score-a.score || String(a.id).localeCompare(String(b.id)));

  const totals=offers.reduce((acc,offer)=>{
    const metrics=offer?.metrics ?? {};
    acc.qualifiedLeads+=nonNegativeInt(metrics.qualifiedLeads);
    acc.customers+=nonNegativeInt(metrics.customers);
    acc.repeatCustomers+=nonNegativeInt(metrics.repeatCustomers);
    acc.monthlyRecurringRevenueCents+=nonNegativeInt(metrics.monthlyRecurringRevenueCents);
    return acc;
  },{qualifiedLeads:0,customers:0,repeatCustomers:0,monthlyRecurringRevenueCents:0});

  return {offers:evaluated,totals,executionAuthority:false};
}

export const REVENUE_ENGINE_POLICY=Object.freeze({
  version:"1.0.0",
  requiredEvidence:Object.freeze([...REQUIRED_EVIDENCE]),
  externalPaymentMutation:false,
  selfAuthorization:false,
});
