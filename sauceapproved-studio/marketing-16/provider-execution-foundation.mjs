function clean(v){return String(v??'').trim();}
function validPublish(x){return x?.schema==='sauceapproved.marketing-16.provider-publish-authorization'&&x?.status==='provider_publish_authorized'&&x?.publishRequestAuthorized===true&&x?.networkCalled===false&&x?.providerMutationPerformed===false&&x?.spendAllowed===false;}
function validSpend(x){return x?.schema==='sauceapproved.marketing-16.provider-spend-authorization'&&x?.status==='provider_spend_authorized'&&x?.spendRequestAuthorized===true&&x?.networkCalled===false&&x?.providerMutationPerformed===false&&x?.spendPerformed===false;}
export function createProviderExecutionFoundation(input={}){
 const p=input.publish,s=input.spend;
 if(!validPublish(p)) throw new Error('provider_publish_authorization_required');
 if(!validSpend(s)) throw new Error('provider_spend_authorization_required');
 if(clean(p.brandId)!==clean(s.brandId)||clean(p.provider)!==clean(s.provider)||clean(p.accountId)!==clean(s.accountId)) throw new Error('provider_authorization_mismatch');
 const engaged=input?.killSwitch?.engaged===true, reason=engaged?clean(input.killSwitch.reason)||'engaged':null;
 const ready=!engaged;
 return Object.freeze({
  schema:'sauceapproved.marketing-16.provider-execution-foundation',version:1,
  connector:Object.freeze({provider:p.provider,accountId:p.accountId,ready}),
  publish:Object.freeze({authorizationId:p.authorizationId,executionReady:ready}),
  spend:Object.freeze({authorizationId:s.authorizationId,budget:s.budget,executionReady:ready}),
  receipt:Object.freeze({status:ready?'execution_prepared':'execution_blocked',auditRequired:true}),
  killSwitch:Object.freeze({engaged,reason}),
  networkCalled:false,providerMutationPerformed:false,publishPerformed:false,spendPerformed:false,automaticMutation:false
 });
}
