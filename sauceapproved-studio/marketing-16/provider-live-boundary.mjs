function clean(value){return String(value??'').trim();}

export function createMarketingKillSwitch(){
  let active=false;
  let reason='';
  return Object.freeze({
    activate(value='owner_stop'){active=true;reason=clean(value)||'owner_stop';return Object.freeze({active,reason});},
    state(){return Object.freeze({active,reason});}
  });
}

export function createProviderConnector({provider,publish}={}){
  const name=clean(provider);
  if(!name) throw new Error('provider_required');
  if(typeof publish!=='function') throw new Error('provider_publish_handler_required');
  return Object.freeze({provider:name,publish});
}

function validAuthorization(value){
  return value?.schema==='sauceapproved.marketing-16.provider-publish-authorization' &&
    value?.status==='provider_publish_authorized' &&
    value?.publishRequestAuthorized===true &&
    value?.networkCalled===false &&
    value?.providerMutationPerformed===false &&
    value?.spendAllowed===false &&
    value?.automaticMutation===false;
}

export async function executeAuthorizedPublish(authorization={},connector,killSwitch){
  if(!validAuthorization(authorization)) throw new Error('provider_publish_authorization_invalid');
  if(!connector||connector.provider!==clean(authorization.provider)||typeof connector.publish!=='function') throw new Error('provider_connector_invalid');
  if(!killSwitch||typeof killSwitch.state!=='function') throw new Error('marketing_kill_switch_required');
  if(killSwitch.state().active) throw new Error('marketing_kill_switch_active');
  const result=await connector.publish(Object.freeze({
    authorizationId:authorization.authorizationId,
    brandId:authorization.brandId,
    accountId:authorization.accountId,
    creativeId:authorization.creativeId,
    destinationUrl:authorization.destinationUrl
  }));
  if(killSwitch.state().active) throw new Error('marketing_kill_switch_active');
  const externalId=clean(result?.externalId);
  if(!externalId) throw new Error('provider_publish_receipt_invalid');
  return Object.freeze({
    schema:'sauceapproved.marketing-16.provider-live-receipt',
    version:1,
    status:'provider_publish_executed',
    provider:connector.provider,
    externalId,
    authorizationId:authorization.authorizationId,
    brandId:authorization.brandId,
    networkCalled:true,
    providerMutationPerformed:true,
    publishPerformed:true,
    spendAllowed:false,
    automaticMutation:false
  });
}
