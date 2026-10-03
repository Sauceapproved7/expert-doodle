export function createMarketingRuntimeConfig(input={}){
 if(input.spendAllowed===true||input.automaticPublishing===true) throw new Error('marketing_runtime_authority_elevation_forbidden');
 const providerConnectors=Object.freeze({...input.providerConnectors});
 const config={providerConnectors,spendAllowed:false,automaticPublishing:false};
 if(input.killSwitch) config.killSwitch=input.killSwitch;
 return Object.freeze(config);
}
