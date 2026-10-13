/** Hercules Floodgates read-only adapter. No launch authorization or writes. */
export const FLOODGATE_KEYS = Object.freeze([
  "spaceship_authorized","dns_verified","shopify_domain_ssl_verified","inventory_verified",
  "payment_provider_live_verified","payout_destination_verified","paid_checkout_verified",
  "refund_verified","owner_launch_approval"
]);
const DOMAIN="sauceapproved.com";
export function offlineFloodgateAssessment(evidence={}, now=new Date().toISOString()){
  const time=Date.parse(now);
  if(!Number.isFinite(time)) throw new TypeError("Invalid clock");
  const checks=FLOODGATE_KEYS.map(key=>{
    const item=evidence?.[key];
    const timestamp=Date.parse(item?.verifiedAt||"");
    const source=key==="owner_launch_approval"?"owner-signed-approval":"trusted-provider-check";
    const valid=item?.verified===true && item?.source===source &&
      item?.domain===DOMAIN && item?.environment==="production" &&
      Number.isFinite(timestamp) && timestamp<=time && time-timestamp<=86400000;
    return {key,passed:Boolean(valid)};
  });
  return {system:"Hercules Floodgates",mode:"read-only-preflight",domain:DOMAIN,
    assessedAt:now,checks,missing:checks.filter(x=>!x.passed).map(x=>x.key),
    policyReady:checks.every(x=>x.passed),ready:false,productionAuthorized:false,
    notice:"Self-reported evidence cannot authorize production. Provider attestations and owner approval must be independently validated by the privileged control plane."};
}
/** Inspect provider status only; do not convert the result into verified evidence. */
export async function inspectSpaceshipStatus(fetcher,endpoint,bearerToken){
  if(typeof fetcher!=="function")throw new TypeError("fetcher required");
  const url=new URL(endpoint);
  if(url.protocol!=="https:" || !url.pathname.endsWith("/functions/v1/hercules-private-bridge"))
    throw new TypeError("Trusted Hercules bridge endpoint required");
  if(typeof bearerToken!=="string"||!bearerToken)throw new TypeError("Authorized session required");
  const response=await fetcher(url.toString(),{
    method:"POST",headers:{"authorization":"Bearer "+bearerToken,"content-type":"application/json"},
    body:JSON.stringify({action:"spaceship_mcp_status"})
  });
  if(!response.ok)throw new Error("spaceship_status_unavailable:"+response.status);
  const body=await response.json();
  return {provider:"spaceship-mcp",status:String(body?.status||"unknown"),
    authorizedAt:body?.authorizedAt||null,secretExposure:false,
    note:"Informational status only; not authenticated launch evidence"};
}
