/** Private server-only Gatehouse buyer/order candidate readback.
 * NEVER mount this as a public route. No token, buyer PII, raw Shopify order ID,
 * checkout, ledger write, report release, or entitlement leaves this adapter.
 * Owner authorization, real provider credentials, and all release gates stay external.
 */
import {preparePrivateOrderCandidate} from "./order-candidate-ledger.mjs";
import {createHmac,timingSafeEqual} from "node:crypto";
const API="https://azymhc-x0.myshopify.com/admin/api/2026-10/graphql.json";
const SHOP_ID="gid://shopify/Shop/100002726208";
const SHOP_DOMAIN="azymhc-x0.myshopify.com";
const ORDER_ID=/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF=/^GH1-[A-Za-z0-9_-]{32}$/;
const HEX_SHA256=/^[0-9a-f]{64}$/;
const INTENT_LIMIT_MS=24*60*60*1000;
const verifiedEmail=x=>typeof x==="string"&&x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
export const PRIVATE_BUYER_ORDER_QUERY=`query GatehousePrivateBuyerOrders($first: Int!) {
 shop { id myshopifyDomain }
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
const noAuthority=Object.freeze({
 candidateMayBeRecorded:false,privateRow:null,providerVerified:false,
 buyerIdentityVerifiedByProvider:false,customerEntitlementGranted:false,
 deliveryAuthorized:false,checkoutEnabled:false,allOrdersVerified:false
});
const deny=reason=>({status:503,body:{
 status:"HOLD",error:reason,shopAuthenticated:false,...noAuthority
}});
const tokenOk=t=>typeof t==="string"&&t.length>=20&&t.length<=4096
 &&/^[\x21-\x7e]+$/.test(t)&&!/[\s"'<>]/.test(t);
const protectedEmailDenied=errors=>Array.isArray(errors)&&errors.some(error=>{
 const message=typeof error?.message==="string"?error.message:"";
 const pathHasEmail=Array.isArray(error?.path)&&error.path.includes("email");
 const accessDenied=error?.extensions?.code==="ACCESS_DENIED"
  ||/not approved|access denied|protected customer data/i.test(message);
 return accessDenied&&(pathHasEmail||/\bemail field\b/i.test(message));
});
function inputOk({identity,intentRow,buyerReference,requestedSiteId,secret,now}){
 if(!identity||!intentRow
  ||!UUID.test(identity.id||"")||!UUID.test(requestedSiteId||"")
  ||!UUID.test(intentRow.id||"")||intentRow.owner_user_id!==identity.id
  ||intentRow.site_id!==requestedSiteId
  ||intentRow.status!=="awaiting-provider-readback"
  ||!REF.test(buyerReference||"")
  ||!HEX_SHA256.test(intentRow.reference_hash||"")
  ||!Buffer.isBuffer(secret)||secret.length<32
  ||!Number.isSafeInteger(now)||now<0
  ||!verifiedEmail(identity.email))return false;
 const expiry=Date.parse(intentRow.expires_at);
 const confirmed=Date.parse(identity.emailConfirmedAt);
 if(!Number.isFinite(expiry)||expiry<=now||expiry-now>INTENT_LIMIT_MS
  ||!Number.isFinite(confirmed)||confirmed>now)return false;
 const expected=createHmac("sha256",secret)
  .update("Gatehouse-intent:v1:"+buyerReference).digest();
 const actual=Buffer.from(intentRow.reference_hash,"hex");
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function createPrivateBuyerOrderReader({
 enabled=false,ownerAuthenticated=false,accessToken="",
 identity,intentRow,buyerReference,requestedSiteId,secret,
 now=Date.now(),fetcher=fetch
}={}){
 async function run(){
  if(enabled!==true)return deny("private-buyer-readback-not-approved");
  if(ownerAuthenticated!==true)return deny("owner-authentication-required");
  if(!tokenOk(accessToken))return deny("native-shopify-access-token-unavailable");
  if(!inputOk({identity,intentRow,buyerReference,requestedSiteId,secret,now}))
   return deny("private-owner-site-intent-required");
  try{
   const response=await fetcher(API,{
    method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),
    headers:{"content-type":"application/json","accept":"application/json",
      "X-Shopify-Access-Token":accessToken},
    body:JSON.stringify({query:PRIVATE_BUYER_ORDER_QUERY,variables:{first:10}})
   });
   if(!response?.ok||response.status!==200)return deny("shopify-api-unavailable");
   const envelope=await response.json();
   if(envelope?.errors?.length)
    return deny(protectedEmailDenied(envelope.errors)?
     "shopify-protected-customer-email-unavailable":"shopify-shop-attestation-unavailable");
   if(envelope?.data?.shop?.id!==SHOP_ID
    ||envelope?.data?.shop?.myshopifyDomain!==SHOP_DOMAIN)
    return deny("shopify-shop-attestation-unavailable");
   const page=envelope.data.orders;
   if(!Array.isArray(page?.edges)||page.edges.length>10
    ||typeof page?.pageInfo?.hasNextPage!=="boolean"
    ||page.edges.some(e=>!e?.node||typeof e.node!=="object"
      ||typeof e.node.id!=="string"||!ORDER_ID.test(e.node.id))
    ||new Set(page.edges.map(e=>e.node.id)).size!==page.edges.length)
    return deny("shopify-order-page-incomplete");
   // Only the privileged backend may ever see the proposal; no public route exists.
   const candidates=page.edges.map(e=>preparePrivateOrderCandidate({
    identity,intentRow,buyerReference,requestedSiteId,
    order:e.node,secret,now
   })).filter(x=>x.candidateMayBeRecorded===true);
   if(candidates.length>1)return deny("ambiguous-private-buyer-correlation");
   // A later page could contain a second order claiming this reference.
   // Do not generate even a local reservation proposal from incomplete history.
   const complete=page.pageInfo.hasNextPage===false;
   const matched=complete&&candidates.length===1;
   return {status:200,body:{
    status:!complete?"incomplete-provider-lookback":
      matched?"private-candidate-proposal-only":"no-local-candidate",
    shopAuthenticated:true,ordersScanned:page.edges.length,
    hasNextPage:page.pageInfo.hasNextPage,
    ...noAuthority,
    candidateMayBeRecorded:matched,
    privateRow:matched?candidates[0].privateRow:null,
    notice:"Private HMAC candidate proposal only. No persistent reservation, authoritative buyer attestation, payment or refund finality, entitlement or delivery."
   }};
  }catch{return deny("shopify-api-unavailable")}
 }
 return {run};
}
