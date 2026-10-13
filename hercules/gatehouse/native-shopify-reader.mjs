/** Independently authorized owner-only readback for the canonical SauceApproved Shopify shop.
 * No customer-facing route may call this without separate server-side owner authentication.
 * No token, PII, raw order IDs, payment mutation, buyer claims or report delivery.
 */
const SHOP_DOMAIN="azymhc-x0.myshopify.com";
const SHOP_ID="gid://shopify/Shop/100002726208";
const PRODUCT_ID="gid://shopify/Product/15424049283392";
const VARIANT_ID="gid://shopify/ProductVariant/67754351460672";
const URL="https://azymhc-x0.myshopify.com/admin/api/2026-10/graphql.json";
export const NATIVE_SHOPIFY_QUERY=`query GatehouseNativeOrders($first: Int!) {
 shop { id myshopifyDomain }
 orders(first: $first, sortKey: CREATED_AT, reverse: true) {
  pageInfo { hasNextPage endCursor }
  edges { node {
   id test cancelledAt displayFinancialStatus currencyCode
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
const cents=value=>typeof value==="string"&&/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/.test(value)?
 Number(value.replace(".","")):NaN;
function candidate(o){
 const lines=o?.lineItems?.nodes,item=Array.isArray(lines)?lines[0]:null;
 return Boolean(o&&typeof o.id==="string"&&/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}$/.test(o.id)&&
  o.test===false&&o.cancelledAt===null&&o.displayFinancialStatus==="PAID"&&
  o.currencyCode==="USD"&&
  o.totalPriceSet?.shopMoney?.currencyCode==="USD"&&cents(o.totalPriceSet?.shopMoney?.amount)>=4900&&
  o.totalRefundedSet?.shopMoney?.currencyCode==="USD"&&cents(o.totalRefundedSet?.shopMoney?.amount)===0&&
  o.lineItems?.pageInfo?.hasNextPage===false&&Array.isArray(lines)&&lines.length===1&&
  item?.sku==="HG-DIAGNOSTIC-49"&&item?.quantity===1&&item?.product?.id===PRODUCT_ID&&
  item?.variant?.id===VARIANT_ID&&item?.originalUnitPriceSet?.shopMoney?.currencyCode==="USD"&&
  cents(item?.originalUnitPriceSet?.shopMoney?.amount)===4900);
}
const noAuthority={
 buyerIdentityVerified:false,customerEntitlementGranted:false,
 deliveryAuthorized:false,payoutVerified:false,subscriptionBillingEnabled:false,
 allOrdersInLookbackVerified:false
};
function error(reason){return {status:503,body:{error:reason,shopAuthenticated:false,...noAuthority}};}
const validToken=x=>typeof x==="string"&&x.length>=20&&x.length<=4096&&/^[\x21-\x7e]+$/.test(x)&&!/[\s\"'<>]/.test(x);
export function createNativeShopifyReader({enabled=false,ownerAuthenticated=false,accessToken="",fetcher=fetch}={}){
 async function run(){
  if(enabled!==true)return error("native-shopify-readback-not-approved");
  if(ownerAuthenticated!==true)return error("owner-authentication-required");
  if(!validToken(accessToken))return error("native-shopify-access-token-unavailable");
  try{
   const response=await fetcher(URL,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json","X-Shopify-Access-Token":accessToken},
    redirect:"error",signal:AbortSignal.timeout(10000),
    body:JSON.stringify({query:NATIVE_SHOPIFY_QUERY,variables:{first:10}})
   });
   if(!response?.ok||response.status!==200)return error("shopify-api-unavailable");
   const data=await response.json();
   if(data?.errors?.length||!data?.data||data.data.shop?.id!==SHOP_ID||
    data.data.shop?.myshopifyDomain!==SHOP_DOMAIN)return error("shopify-shop-attestation-unavailable");
   const page=data.data.orders;
   if(!Array.isArray(page?.edges)||page.edges.length>10||
    typeof page?.pageInfo?.hasNextPage!=="boolean"||
    page.edges.some(e=>!e?.node||typeof e.node!=="object"))return error("shopify-order-page-incomplete");
   return {status:200,body:{
    schema:"hercules.gatehouse.native-order-observation.v1",
    status:"readback-candidates-only",
    source:"shopify-admin-live-readback",
    shopAuthenticated:true,ordersScanned:page.edges.length,
    candidateCount:page.edges.filter(e=>candidate(e.node)).length,
    hasNextPage:page.pageInfo.hasNextPage,
    ...noAuthority,
    notice:"Admin API authorization and canonical shop were checked. Matching orders are only candidates; no verified buyer, refund finality, paid entitlement, payout or report release."
   }};
  }catch{return error("shopify-api-unavailable")}
 }
 return {run};
}
