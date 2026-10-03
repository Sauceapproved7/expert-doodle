function textValue(value){return String(value??'').trim();}

export function dryRunProviderCampaign(prepared={},payload={}){
  if(prepared?.schema!=='sauceapproved.marketing-16.controlled-execution'||prepared?.status!=='campaign_prepared'||prepared?.authorized!==true||prepared?.operation!=='prepare_campaign') throw new Error('prepared_campaign_required');
  const provider=textValue(payload.provider);
  const accountId=textValue(payload.accountId);
  const creativeId=textValue(payload.creativeId);
  const destinationUrl=textValue(payload.destinationUrl);
  const currency=textValue(payload?.budget?.currency);
  const amount=Number(payload?.budget?.amount);
  let destination;
  try{destination=new URL(destinationUrl);}catch{throw new Error('provider_payload_invalid');}
  if(!provider||!accountId||!creativeId||!currency||!Number.isFinite(amount)||amount<=0||!['https:'].includes(destination.protocol)) throw new Error('provider_payload_invalid');
  return Object.freeze({
    schema:'sauceapproved.marketing-16.provider-dry-run',
    version:1,
    status:'provider_dry_run_valid',
    provider,
    accountId,
    creativeId,
    destinationUrl:destination.toString(),
    budget:Object.freeze({currency,amount}),
    authorizationId:prepared.authorizationId,
    brandId:prepared.brandId,
    recommendation:prepared.recommendation,
    evidenceIds:Object.freeze([...(prepared.evidenceIds||[])]),
    networkCalled:false,
    executionAuthorized:false,
    publishAllowed:false,
    spendAllowed:false,
    storefrontMutationAllowed:false,
    paymentAllowed:false,
    dnsMutationAllowed:false,
    automaticMutation:false
  });
}
