function clean(value){return String(value??'').trim();}

export function createMetricoolProviderProfile(input={}){
 if(input.spendAllowed===true||input.automaticPublishing===true) throw new Error('metricool_provider_authority_elevation_forbidden');
 const brandId=clean(input.brandId);
 if(!brandId) throw new Error('metricool_brand_id_required');
 return Object.freeze({
  provider:'metricool',
  brandId,
  brandLabel:clean(input.brandLabel),
  timezone:clean(input.timezone),
  networks:Object.freeze([...(input.networks||[])].map(clean).filter(Boolean)),
  connectivity:'live_read_only_verified',
  credentialRef:'connector://metricool',
  credentialsEmbedded:false,
  spendAllowed:false,
  automaticPublishing:false
 });
}
