import {createMetricoolPublishAdapter} from './metricool-publish-adapter.mjs';
import {createRuntimeConnectorMap} from './runtime-connector-map.mjs';

export function createMetricoolRuntimeWiring(input={}){
 if(input.spendAllowed===true||input.automaticPublishing===true) throw new Error('metricool_runtime_authority_elevation_forbidden');
 const adapters=[];
 if(typeof input.publish==='function'){
  adapters.push(createMetricoolPublishAdapter({brandId:input.brandId,publish:input.publish}));
 }
 const providerConnectors=createRuntimeConnectorMap(adapters);
 return Object.freeze({
  providers:Object.freeze(Object.keys(providerConnectors).sort()),
  providerConnectors,
  spendAllowed:false,
  automaticPublishing:false
 });
}
