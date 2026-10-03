function clean(value){return String(value??'').trim();}

function validDryRun(receipt){
  return receipt?.schema==='sauceapproved.marketing-16.provider-dry-run' &&
    receipt?.status==='provider_dry_run_valid' &&
    receipt?.networkCalled===false &&
    receipt?.executionAuthorized===false &&
    Boolean(clean(receipt?.provider)) &&
    Boolean(clean(receipt?.accountId)) &&
    Boolean(clean(receipt?.creativeId));
}

export function authorizeProviderPublish(dryRun={},authorization={}){
  if(!validDryRun(dryRun)) throw new Error('valid_provider_dry_run_required');
  if(authorization?.approved!==true) throw new Error('provider_publish_not_authorized');
  const authorizationId=clean(authorization.authorizationId);
  const brandId=clean(authorization.brandId);
  const operation=clean(authorization.operation);
  const evidenceIds=Array.isArray(authorization.evidenceIds)?[...new Set(authorization.evidenceIds.map(clean).filter(Boolean))]:[];
  if(!authorizationId||!brandId||!evidenceIds.length) throw new Error('provider_publish_not_authorized');
  if(operation!=='authorize_provider_publish') throw new Error('provider_publish_operation_not_allowed');
  if(brandId!==clean(dryRun.brandId)) throw new Error('provider_publish_brand_mismatch');
  return Object.freeze({
    schema:'sauceapproved.marketing-16.provider-publish-authorization',
    version:1,
    status:'provider_publish_authorized',
    publishRequestAuthorized:true,
    authorizationId,
    brandId,
    provider:dryRun.provider,
    accountId:dryRun.accountId,
    creativeId:dryRun.creativeId,
    destinationUrl:dryRun.destinationUrl,
    budget:dryRun.budget,
    recommendation:dryRun.recommendation,
    evidenceIds:Object.freeze(evidenceIds),
    networkCalled:false,
    providerMutationPerformed:false,
    spendAllowed:false,
    storefrontMutationAllowed:false,
    paymentAllowed:false,
    dnsMutationAllowed:false,
    automaticMutation:false
  });
}
