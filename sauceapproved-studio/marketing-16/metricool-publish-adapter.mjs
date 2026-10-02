function clean(value){return String(value??'').trim();}

export function createMetricoolPublishAdapter(config={}){
 if(config.token||config.apiKey||config.secret) throw new Error('embedded_provider_credentials_forbidden');
 if(config.spendAllowed===true||config.automaticPublishing===true) throw new Error('metricool_publish_authority_elevation_forbidden');
 const brandId=clean(config.brandId);
 if(!brandId) throw new Error('metricool_brand_id_required');
 if(typeof config.publish!=='function') throw new Error('metricool_publish_handler_required');
 return Object.freeze({
  provider:'metricool',
  credentialRef:'connector://metricool',
  credentialsEmbedded:false,
  spendAllowed:false,
  automaticMutation:false,
  async publish(input={}){
   return config.publish(Object.freeze({
    authorizationId:clean(input.authorizationId),
    creativeId:clean(input.creativeId),
    destinationUrl:clean(input.destinationUrl),
    brandId,
    spendAllowed:false,
    autoPublish:false
   }));
  }
 });
}
