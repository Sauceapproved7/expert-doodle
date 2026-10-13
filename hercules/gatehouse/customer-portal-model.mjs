/** Pure public-onboarding illustration, not customer intake or a sales authorization. */
import {normalizeIntake} from "./commerce.mjs";
export function previewSite(value){
 const result=normalizeIntake({website:value,authorized:true});
 return {
  origin:result.website,status:"format-check-only",ownershipVerified:false,
  accountCreated:false,orderVerified:false,siteScanned:false,
  dataSubmitted:false,deliveryAuthorized:false
 };
}
/** These are deliberate launch guarantees: this endpoint cannot open a commercial gate. */
export function portalReadiness(){
 return {
  product:"Hercules Gatehouse Website Health Diagnostic",
  status:"preview-only",
  priceUSD:"49.00",
  registrationOpen:false,checkoutEnabled:false,customerDataCollectionEnabled:false,
  domainScanningEnabled:false,reportDeliveryEnabled:false,subscriptionsEnabled:false,
  accountAuthenticationVerified:false,paidOrderVerified:false,
  nextMilestone:"Owner-approved customer policies, tested login, domain control, provider paid-order confirmation and private delivery",
  notice:"The browser-only origin example never submits a website or creates a customer account."
 };
}
