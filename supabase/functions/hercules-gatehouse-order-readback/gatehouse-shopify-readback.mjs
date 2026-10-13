/** Owner-authenticated Shopify order readback contract.
 * No payment changes, no PII collection, no fulfillments, no public results.
 */
export const CANONICAL_SHOP="sauceapproved-2.myshopify.com";
const PRODUCT_ID="gid://shopify/Product/15424049283392";
const VARIANT_ID="gid://shopify/ProductVariant/67754351460672";
const SKU="HG-DIAGNOSTIC-49";
export const SHOPIFY_ORDER_QUERY=`query GatehouseRecentOrders($first: Int!) {
 orders(first: $first, sortKey: CREATED_AT, reverse: true) {
  pageInfo { hasNextPage endCursor }
  edges { node {
   id test cancelledAt displayFinancialStatus currencyCode
   totalPriceSet { shopMoney { amount currencyCode } }
   totalRefundedSet { shopMoney { amount currencyCode } }
   lineItems(first: 10) { pageInfo { hasNextPage } nodes {
    id sku quantity product { id } variant { id }
    originalUnitPriceSet { shopMoney { amount currencyCode } }
   } }
  } }
 }
}`;
export function verifyOrderScope({provider,shopDomain,connectionStatus,membershipActive,role}={}){
 return provider==="shopify"&&shopDomain===CANONICAL_SHOP&&connectionStatus==="active"
  &&membershipActive===true&&["owner","admin"].includes(role);
}
function cents(value){
 if(typeof value!=="string"||!/^(0|[1-9][0-9]{0,9})\.[0-9]{2}$/.test(value))return null;
 const [a,b]=value.split(".");
 const number=Number(a)*100+Number(b);
 return Number.isSafeInteger(number)?number:null;
}
export function productLineCandidate(order){
 const item=order?.lineItems?.nodes;
 if(!order||!/^gid:\/\/shopify\/Order\/[1-9][0-9]*$/.test(order.id||"")||
  order.test!==false||order.cancelledAt!==null||order.displayFinancialStatus!=="PAID"||
  order.currencyCode!=="USD"||order.lineItems?.pageInfo?.hasNextPage!==false||
  !Array.isArray(item)||item.length!==1)return false;
 const price=order.totalPriceSet?.shopMoney,refund=order.totalRefundedSet?.shopMoney;
 if(price?.currencyCode!=="USD"||refund?.currencyCode!=="USD"||
  cents(price.amount)===null||cents(price.amount)<4900||cents(refund.amount)!==0)return false;
 const line=item[0],unit=line?.originalUnitPriceSet?.shopMoney;
 return line?.sku===SKU&&line?.quantity===1&&line?.product?.id===PRODUCT_ID&&
  line?.variant?.id===VARIANT_ID&&unit?.currencyCode==="USD"&&cents(unit?.amount)===4900;
}
export function summarizeShopifyOrders(data){
 const page=data?.orders;
 if(!page||!Array.isArray(page.edges)||typeof page.pageInfo?.hasNextPage!=="boolean"
  ||page.edges.some(x=>!x||typeof x.node!=="object"||!x.node))
  throw new TypeError("Incomplete Shopify order response");
 const matches=page.edges.map(e=>e.node).filter(productLineCandidate);
 return {
  source:"shopify-admin-readback",mode:"read-only",
  ordersScanned:page.edges.length,boundedResultSize:page.edges.length,
  hasNextPage:page.pageInfo.hasNextPage,allOrdersInLookbackVerified:false,
  candidateCount:matches.length,
  candidates:matches.map(o=>({status:"readback-candidate-only",
   productCode:"gatehouse-diagnostic-49",grossCents:cents(o.totalPriceSet.shopMoney.amount),
   currency:"USD"})),
  providerIdentityVerified:false,buyerIdentityVerified:false,payoutVerified:false,
  checkoutModified:false,deliveryAuthorized:false,subscriptionBillingEnabled:false,
  note:"Read-only Shopify Admin order observations. Never grants report delivery, buyer entitlement, or payout proof."
 };
}
