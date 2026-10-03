function clean(value){return String(value??'').trim();}

function validPublishAuthorization(value){
  return value?.schema==='sauceapproved.marketing-16.provider-publish-authorization' &&
    value?.status==='provider_publish_authorized' &&
    value?.publishRequestAuthorized===true &&
    value?.networkCalled===false &&
    value?.providerMutationPerformed===false &&
    value?.spendAllowed===false &&
    Boolean(clean(value?.brandId)) &&
    Boolean(clean(value?.provider)) &&
    Boolean(clean(value?.accountId));
}

export function authorizeProviderSpend(publishAuthorization={},authorization={}){
  if(!validPublishAuthorization(publishAuthorization)) throw new Error('provider_publish_authorization_required');
  if(authorization?.approved!==true) throw new Error('provider_spend_not_authorized');
  const authorizationId=clean(authorization.authorizationId);
  const brandId=clean(authorization.brandId);
  const operation=clean(authorization.operation);
  const currency=clean(authorization.currency);
  const maxAmount=Number(authorization.maxAmount);
  const evidenceIds=Array.isArray(authorization.evidenceIds)?[...new Set(authorization.evidenceIds.map(clean).filter(Boolean))]:[];
  if(!authorizationId||!brandId||!currency||!Number.isFinite(maxAmount)||maxAmount<=0||!evidenceIds.length) throw new Error('provider_spend_not_authorized');
  if(operation!=='authorize_provider_spend') throw new Error('provider_spend_operation_not_allowed');
  if(brandId!==clean(publishAuthorization.brandId)) throw new Error('provider_spend_brand_mismatch');
  const budgetCurrency=clean(publishAuthorization?.budget?.currency);
  const budgetAmount=Number(publishAuthorization?.budget?.amount);
  if(currency!==budgetCurrency) throw new Error('provider_spend_currency_mismatch');
  if(!Number.isFinite(budgetAmount)||budgetAmount<=0||budgetAmount>maxAmount) throw new Error('provider_spend_budget_exceeds_authorization');
  return Object.freeze({
    schema:'sauceapproved.marketing-16.provider-spend-authorization',
    version:1,
    status:'provider_spend_authorized',
    spendRequestAuthorized:true,
    authorizationId,
    brandId,
    provider:publishAuthorization.provider,
    accountId:publishAuthorization.accountId,
    budget:Object.freeze({currency:budgetCurrency,amount:budgetAmount,maxAuthorizedAmount:maxAmount}),
    evidenceIds:Object.freeze(evidenceIds),
    networkCalled:false,
    providerMutationPerformed:false,
    spendPerformed:false,
    automaticMutation:false
  });
}
