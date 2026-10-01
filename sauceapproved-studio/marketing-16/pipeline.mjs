function clean(value){return String(value??'').trim();}

function controlled(adapter){
 return adapter&&clean(adapter.provider)&&typeof adapter.publish==='function'&&adapter.credentialsEmbedded===false&&adapter.spendAllowed===false&&adapter.automaticMutation===false;
}

export function createMarketing16Pipeline(input={}){
 if(input.spendAllowed===true||input.automaticPublishing===true) throw new Error('marketing_pipeline_authority_elevation_forbidden');
 const providerConnectors={};
 for(const adapter of input.adapters||[]){
  if(!controlled(adapter)) throw new Error('provider_adapter_not_controlled');
  const provider=clean(adapter.provider);
  if(Object.hasOwn(providerConnectors,provider)) throw new Error('provider_already_registered');
  providerConnectors[provider]=adapter.publish;
 }
 const runtimeConfig={providerConnectors:Object.freeze(providerConnectors),spendAllowed:false,automaticPublishing:false};
 if(input.killSwitch) runtimeConfig.killSwitch=input.killSwitch;
 return Object.freeze({
  providers:Object.freeze(Object.keys(providerConnectors).sort()),
  runtimeConfig:Object.freeze(runtimeConfig),
  spendAllowed:false,
  automaticPublishing:false
 });
}
