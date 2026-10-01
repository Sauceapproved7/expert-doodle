const ALLOWED_OPERATIONS=Object.freeze(new Set(['prepare_campaign']));

function validReceipt(receipt){
  return receipt?.schema==='sauceapproved.studio.performance-brain.review-receipt' &&
    receipt?.status==='review_recorded' &&
    receipt?.decision==='approved' &&
    Boolean(String(receipt?.recommendation||'').trim());
}

export function authorizeControlledMarketingExecution(receipt={},authorization={}){
  if(!validReceipt(receipt)) throw new Error('approved_review_required');
  if(authorization?.approved!==true) throw new Error('execution_not_authorized');
  const authorizationId=String(authorization.authorizationId||'').trim();
  const brandId=String(authorization.brandId||'').trim();
  const operation=String(authorization.operation||'').trim();
  const evidenceIds=Array.isArray(authorization.evidenceIds)?[...new Set(authorization.evidenceIds.map(String).map(x=>x.trim()).filter(Boolean))]:[];
  if(!authorizationId||!brandId||!evidenceIds.length) throw new Error('execution_not_authorized');
  if(!ALLOWED_OPERATIONS.has(operation)) throw new Error('operation_not_allowed');
  return Object.freeze({
    schema:'sauceapproved.marketing-16.controlled-execution',
    version:1,
    authorized:true,
    authorizationId,
    brandId,
    operation,
    recommendation:receipt.recommendation,
    evidenceIds:Object.freeze(evidenceIds),
    publishAllowed:false,
    spendAllowed:false,
    storefrontMutationAllowed:false,
    paymentAllowed:false,
    dnsMutationAllowed:false,
    entitlementMutationAllowed:false,
    automaticMutation:false
  });
}
