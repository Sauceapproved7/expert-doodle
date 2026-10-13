/** HMAC-only order-to-intent reservation. Never constitutes provider, payment or delivery proof.
 * Private server-side model. No public API, external requests or persistence side effects.
 */
import {createHmac} from "node:crypto";
import {assessPurchaseCandidate} from "./purchase-link.mjs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function failure(){
 return {candidateMayBeRecorded:false,privateRow:null,
  providerVerified:false,buyerIdentityVerifiedByProvider:false,
  customerEntitlementGranted:false,deliveryAuthorized:false,checkoutEnabled:false};
}
export function preparePrivateOrderCandidate({identity,intentRow,buyerReference,requestedSiteId,order,secret,now}={}){
 const denied=failure();
 if(!intentRow||!UUID.test(intentRow.id||"")||
  !Buffer.isBuffer(secret)||secret.length<32)return denied;
 const assessed=assessPurchaseCandidate({identity,intentRow,buyerReference,requestedSiteId,order,secret,now});
 // Caller-provided order shape is never an attested provider readback.
 if(assessed?.localChecksMatched!==true||assessed.deliveryAuthorized!==false||
  assessed.providerReadbackVerified!==false||typeof assessed.orderId!=="string")return denied;
 const orderHash=createHmac("sha256",secret).update("Gatehouse:order-candidate:v1:"+assessed.orderId).digest("hex");
 return {
  candidateMayBeRecorded:true,
  privateRow:{
   intent_id:intentRow.id,owner_user_id:intentRow.owner_user_id,site_id:intentRow.site_id,
   order_hash:orderHash,candidate_status:"requires-provider-verification",
   provider:"shopify",item_unit_cents:4900
  },
  providerVerified:false,buyerIdentityVerifiedByProvider:false,
  customerEntitlementGranted:false,deliveryAuthorized:false,checkoutEnabled:false
 };
}
