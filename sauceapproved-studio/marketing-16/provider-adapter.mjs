function textValue(value){return String(value??'').trim();}

function validAuthorization(authorization){
  return authorization?.schema==='sauceapproved.marketing-16.provider-publish-authorization' &&
    authorization?.status==='provider_publish_authorized' &&
    authorization?.publishRequestAuthorized===true &&
    authorization?.networkCalled===false &&
    authorization?.providerMutationPerformed===false &&
    authorization?.spendAllowed===false &&
    authorization?.automaticMutation===false &&
    Boolean(textValue(authorization?.authorizationId)) &&
    Boolean(textValue(authorization?.brandId)) &&
    Boolean(textValue(authorization?.provider)) &&
    Boolean(textValue(authorization?.accountId)) &&
    Boolean(textValue(authorization?.creativeId));
}

export function simulateProviderPublish(authorization={}){
  if(authorization?.publishRequestAuthorized!==true) throw new Error('provider_publish_authorization_required');
  if(!validAuthorization(authorization)) throw new Error('provider_publish_authorization_invalid');
  return Object.freeze({
    schema:'sauceapproved.marketing-16.provider-adapter-receipt',
    version:1,
    status:'provider_publish_simulated',
    authorizationId:authorization.authorizationId,
    brandId:authorization.brandId,
    provider:authorization.provider,
    accountId:authorization.accountId,
    creativeId:authorization.creativeId,
    destinationUrl:authorization.destinationUrl,
    recommendation:authorization.recommendation,
    evidenceIds:Object.freeze([...(authorization.evidenceIds||[])]),
    networkCalled:false,
    providerMutationPerformed:false,
    publishPerformed:false,
    executionMode:'simulation',
    spendAllowed:false,
    storefrontMutationAllowed:false,
    paymentAllowed:false,
    dnsMutationAllowed:false,
    automaticMutation:false
  });
}
