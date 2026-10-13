/** Preview-only buyer-to-order correlation, NEVER proof of a real provider transaction.
 * No endpoints mint references, no order reads are connected, and no entitlements can be created.
 */
import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT="gid://shopify/Product/15424049283392";
const VARIANT="gid://shopify/ProductVariant/67754351460672";
const ATTRIBUTE="gatehouse_intent_v1";
const LIMIT_MS=24*3600000;
const reject=()=>({
 status:"unverified",localChecksMatched:false,
 providerReadbackVerified:false,buyerIdentityVerifiedByProvider:false,
 customerEntitlementGranted:false,deliveryAuthorized:false
});
function validSecret(key){return (typeof key==="string"||Buffer.isBuffer(key))&&Buffer.byteLength(key)>=32}
function hash(key,reference){return createHmac("sha256",key).update("Gatehouse-intent:v1:"+reference).digest("hex")}
function money(amount){return typeof amount==="string"&&/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/.test(amount)?Number(amount.replace(".","")):NaN}
const email=value=>typeof value==="string"&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value.toLowerCase():null;
/** Future intent creation is restricted to a verified authenticated account and owned site. */
export function makePurchaseIntent({ownerUserId,siteId,secret,now=Date.now(),nonce=randomBytes(24)}={}){
 if(!UUID.test(ownerUserId||"")||!UUID.test(siteId||"")||!validSecret(secret)
  ||!Buffer.isBuffer(nonce)||nonce.length!==24
  ||!Number.isSafeInteger(now)||now<0)throw new TypeError("Invalid authenticated intent inputs");
 const buyerReference="GH1-"+nonce.toString("base64url");
 const expiry=new Date(now+LIMIT_MS).toISOString();
 return {
  buyerReference,
  privateRow:{owner_user_id:ownerUserId,site_id:siteId,reference_hash:hash(secret,buyerReference),
   status:"awaiting-provider-readback",expires_at:expiry},
  checkoutCreated:false,deliveryAuthorized:false,customerEntitlementGranted:false,
  notice:"A reference is only a private correlation proposal, not an active cart, payment or buyer claim."
 };
}
export const SHOPIFY_PURCHASE_QUERY=`query GatehouseRecentOrders($first: Int!) {
 orders(first: $first, sortKey: CREATED_AT, reverse: true) {
  pageInfo { hasNextPage endCursor }
  edges { node {
   id email test cancelledAt displayFinancialStatus currencyCode
   customAttributes { key value }
   totalPriceSet { shopMoney { amount currencyCode } }
   totalRefundedSet { shopMoney { amount currencyCode } }
   lineItems(first: 10) {
     pageInfo { hasNextPage }
     nodes { sku quantity product { id } variant { id }
      originalUnitPriceSet { shopMoney { amount currencyCode } } }
   }
  } }
 }
}`;
/** Assesses ONLY local shapes. It is NOT called by a provider-authenticated adapter.
 * Never use this return value to deliver a paid report, even if localChecksMatched is true.
 */
export function assessPurchaseCandidate({identity,intentRow,buyerReference,order,secret,now=Date.now(),requestedSiteId}={}){
 const fail=reject();
 if(!identity||!intentRow||!order||!validSecret(secret)||
  !UUID.test(identity.id||"")||!UUID.test(requestedSiteId||"")||
  intentRow.owner_user_id!==identity.id||intentRow.site_id!==requestedSiteId||
  intentRow.status!=="awaiting-provider-readback"||
  typeof buyerReference!=="string"||!/^GH1-[A-Za-z0-9_-]{32}$/.test(buyerReference)||
  !/^[0-9a-f]{64}$/.test(intentRow.reference_hash||"")||
  !Number.isSafeInteger(now)||now<0)return fail;
 const expires=Date.parse(intentRow.expires_at);
 const confirmation=Date.parse(identity.emailConfirmedAt);
 if(!Number.isFinite(expires)||expires<=now||expires-now>LIMIT_MS||
  !Number.isFinite(confirmation)||confirmation>now||!email(identity.email)||
  email(identity.email)!==email(order.email))return fail;
 const a=Buffer.from(intentRow.reference_hash,"hex");
 const b=Buffer.from(hash(secret,buyerReference),"hex");
 if(a.length!==b.length||!timingSafeEqual(a,b))return fail;
 const items=order.lineItems?.nodes;
 const attrs=Array.isArray(order.customAttributes)?
  order.customAttributes.filter(a=>a?.key===ATTRIBUTE):[];
 if(!/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}$/.test(order.id||"")||
  order.test!==false||order.cancelledAt!==null||
  order.displayFinancialStatus!=="PAID"||order.currencyCode!=="USD"||
  money(order.totalPriceSet?.shopMoney?.amount)!==4900||
  order.totalPriceSet?.shopMoney?.currencyCode!=="USD"||
  money(order.totalRefundedSet?.shopMoney?.amount)!==0||
  order.totalRefundedSet?.shopMoney?.currencyCode!=="USD"||
  order.lineItems?.pageInfo?.hasNextPage!==false||
  !Array.isArray(items)||items.length!==1||
  items[0]?.product?.id!==PRODUCT||items[0]?.variant?.id!==VARIANT||
  items[0]?.sku!=="HG-DIAGNOSTIC-49"||items[0]?.quantity!==1||
  money(items[0]?.originalUnitPriceSet?.shopMoney?.amount)!==4900||
  items[0]?.originalUnitPriceSet?.shopMoney?.currencyCode!=="USD"||
  attrs.length!==1||attrs[0].value!==buyerReference)return fail;
 return {
  status:"candidate-needs-authoritative-readback",
  localChecksMatched:true,orderId:order.id,
  providerReadbackVerified:false,buyerIdentityVerifiedByProvider:false,
  customerEntitlementGranted:false,deliveryAuthorized:false,
  notice:"Matching a caller-provided order shape and intent is NOT live Shopify proof, customer identity attestation or permission to fulfill."
 };
}
export function buildPurchaseLinkReadiness(){
 return {schema:"hercules.gatehouse.purchase-link-status.v1",
  status:"HOLD",offerPriceUSD:"49.00",shopifyProductStatus:"DRAFT",
  opaqueReferenceModelBuilt:true,customerIntentIssuanceEnabled:false,
  nativeShopifyReaderConnected:false,checkoutCorrelationConnected:false,
  orderToBuyerLinkVerified:false,customerEntitlementGranted:false,
  purchaseEnabled:false,deliveryAuthorized:false,
  outstanding:["Legitimate backend Shopify read_orders authorization",
   "Owner-approved customer identity and consent", "Private intent record lifecycle and replay prevention",
   "Shopify checkout reference association and authoritative paid/refunded order readback",
   "Buyer-scoped report generation, delivery and refund test"]};
}
