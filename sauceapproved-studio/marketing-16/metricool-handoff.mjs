function clean(value){return String(value??'').trim();}

export function createMetricoolHandoff(input={}){
 if(input.autoPublish===true||input.spendAllowed===true) throw new Error('metricool_handoff_authority_elevation_forbidden');
 const brandId=clean(input.brandId);
 const authorizationId=clean(input.authorizationId);
 if(!brandId) throw new Error('metricool_brand_id_required');
 if(!authorizationId) throw new Error('authorization_id_required');
 return Object.freeze({
  schema:'sauceapproved.marketing-16.metricool-handoff',
  status:'approval_ready',
  provider:'metricool',
  brandId,
  authorizationId,
  creativeId:clean(input.creativeId),
  network:clean(input.network),
  text:clean(input.text),
  credentialRef:'connector://metricool',
  autoPublish:false,
  spendAllowed:false,
  mutationPerformed:false
 });
}
