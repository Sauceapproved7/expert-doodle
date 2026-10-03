function clean(value){return String(value??'').trim();}

export function createControlledProviderAdapter(config={}){
  const provider=clean(config.provider);
  const credentialRef=clean(config.credentialRef);
  if(!provider) throw new Error('provider_required');
  if(config.token||config.apiKey||config.secret) throw new Error('embedded_provider_credentials_forbidden');
  if(!credentialRef) throw new Error('provider_credential_reference_required');
  if(typeof config.publish!=='function') throw new Error('provider_publish_handler_required');

  return Object.freeze({
    provider,
    credentialRef,
    credentialsEmbedded:false,
    spendAllowed:false,
    automaticMutation:false,
    async publish(input={}){
      return config.publish(Object.freeze({
        authorizationId:clean(input.authorizationId),
        brandId:clean(input.brandId),
        accountId:clean(input.accountId),
        creativeId:clean(input.creativeId),
        destinationUrl:clean(input.destinationUrl),
        credentialRef,
        spendAllowed:false,
        automaticMutation:false
      }));
    }
  });
}
