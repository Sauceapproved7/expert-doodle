function clean(v){return String(v??'').trim();}
export function createMetricoolLiveBoundary(foundation={},config={}){
 if(foundation?.schema!=='sauceapproved.marketing-16.provider-execution-foundation'||foundation?.connector?.provider!=='metricool') throw new Error('metricool_execution_foundation_required');
 const credentialRef=clean(config.credentialRef);
 if(!credentialRef||config.token||config.apiKey||config.secret) throw new Error('metricool_credential_reference_required');
 const stopped=foundation?.killSwitch?.engaged===true;
 const ready=!stopped&&foundation?.connector?.ready===true&&foundation?.publish?.executionReady===true&&foundation?.spend?.executionReady===true;
 const budget=foundation?.spend?.budget||{};
 if(!Number.isFinite(Number(budget.amount))||Number(budget.amount)<=0||Number(budget.amount)>Number(budget.maxAuthorizedAmount)) throw new Error('metricool_budget_not_authorized');
 return Object.freeze({
  schema:'sauceapproved.marketing-16.metricool-live-boundary',version:1,status:ready?'ready_for_owner_connected_execution':'blocked',
  adapter:Object.freeze({provider:'metricool',accountId:foundation.connector.accountId,credentialRef,credentialsEmbedded:false}),
  publish:Object.freeze({authorizationId:foundation.publish.authorizationId,status:ready?'authorized_pending_execution':'blocked',executionReady:ready}),
  spend:Object.freeze({authorizationId:foundation.spend.authorizationId,currency:budget.currency,amount:Number(budget.amount),maxAmount:Number(budget.maxAuthorizedAmount),executionReady:ready}),
  receipt:Object.freeze({required:true,status:'pending_provider_receipt',providerCampaignId:null,providerStatus:null}),
  killSwitch:Object.freeze({engaged:stopped,reason:foundation?.killSwitch?.reason||null}),
  networkCalled:false,providerMutationPerformed:false,publishPerformed:false,spendPerformed:false,automaticMutation:false
 });
}
