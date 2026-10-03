import {createMarketingKillSwitch,createProviderConnector,executeAuthorizedPublish} from './provider-live-boundary.mjs';

export async function runMarketing16Simulation({authorization,killSwitchActive=false}={}){
 const killSwitch=createMarketingKillSwitch();
 if(killSwitchActive) killSwitch.activate('simulation_stop');
 const connector=createProviderConnector({
  provider:'simulation',
  publish:async(input)=>({externalId:`sim-${input.authorizationId}`})
 });
 const receipt=await executeAuthorizedPublish(authorization,connector,killSwitch);
 return Object.freeze({
  status:'simulation_publish_executed',
  provider:receipt.provider,
  externalId:receipt.externalId,
  authorizationId:receipt.authorizationId,
  realNetworkCalled:false,
  realProviderMutationPerformed:false,
  spendAllowed:false,
  automaticPublishing:false
 });
}
