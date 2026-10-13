/** First-party, fail-closed website intake model. No customer identity or financial input from the browser is trusted. */
import {normalizeIntake} from "./commerce.mjs";
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONSENT_VERSION="gatehouse-diagnostic-v1";
export function normalizeCustomerRequest(submitted={}){
 if(!submitted||typeof submitted!=="object"||Array.isArray(submitted))
  throw new TypeError("Invalid request");
 if(submitted.authorized!==true||submitted.consentVersion!==CONSENT_VERSION)
  throw new TypeError("Explicit current authorization and consent required");
 const site=normalizeIntake({website:submitted.website,authorized:true});
 return {origin:site.website,authorized:true,consentVersion:CONSENT_VERSION,
  stage:"awaiting-domain-control"};
}
export function buildTenantSiteRow({userId,submitted,now=new Date().toISOString()}={}){
 if(typeof userId!=="string"||!UID.test(userId))throw new TypeError("Authenticated identity required");
 const stamp=Date.parse(now);
 if(typeof now!=="string"||!Number.isFinite(stamp)||new Date(stamp).toISOString()!==now)
  throw new TypeError("Invalid timestamp");
 const req=normalizeCustomerRequest(submitted);
 return {owner_user_id:userId,origin:req.origin,
  consent_version:req.consentVersion,authorized_at:now,
  stage:"awaiting-domain-control"};
}
/** No caller-provided state can release paid content. */
export function assessDelivery(){
 return {status:"HOLD",customerReportReleased:false,verifiedPaidOrder:false,
  reportDeliveryEnabled:false,subscriptionBillingEnabled:false,
  notice:"Authenticated intake does not establish site ownership, purchase, report accuracy or buyer delivery."};
}
/** Safe external receipt, deliberately excludes tenant identifiers or site content. */
export function publicAccountState(input={}){
 return {stage:input?.stage==="awaiting-domain-control"?"awaiting-domain-control":"not-started",
  domainControlVerified:false,paidOrderVerified:false,
  reportDelivered:false,purchaseEnabled:false};
}
