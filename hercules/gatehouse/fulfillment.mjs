/** Hercules Gatehouse commercial fulfillment contract.
 * Publicly safe read-only evidence planning. No Shopify connector, no checkout,
 * no customer contact, no paid-order observation and no message transport.
 */
const PRODUCT_ID="gid://shopify/Product/15424049283392";
const VARIANT_ID="gid://shopify/ProductVariant/67754351460672";
const SHOP_DOMAIN="sauceapproved-2.myshopify.com";
const KNOWN=new Set(["Hercules MCP","Studio","Smallz","Domain Guard"]);
const CONNECTIVITY=new Set(["reachable","unreachable"]);
export const REQUIRED_GATES=Object.freeze([
 "authorized Shopify paid-order read-back and refund check",
 "authenticated customer intake and verified domain control",
 "safe domain probe with DNS rebinding and private IP defenses",
 "customer-isolated durable report storage",
 "verified report delivery with correct buyer identity",
 "approved applicable service terms and privacy",
 "documented refunds, cancellation and support",
 "independent end-to-end purchase and fulfillment proof"
]);
export function checkOrderReadback(order={}){
 const expected=order&&typeof order==="object"&&
  order.shopDomain===SHOP_DOMAIN&&
  typeof order.orderId==="string"&&/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,19}$/.test(order.orderId)&&
  order.currencyCode==="USD"&&order.totalPrice==="49.00"&&
  order.financialStatus==="PAID"&&order.cancelledAt===null&&
  order.refundTotal==="0.00"&&
  Array.isArray(order.lineItems)&&order.lineItems.length===1&&
  order.lineItems[0]?.productId===PRODUCT_ID&&
  order.lineItems[0]?.variantId===VARIANT_ID&&
  order.lineItems[0]?.sku==="HG-DIAGNOSTIC-49"&&
  order.lineItems[0]?.quantity===1&&
  order.lineItems[0]?.unitPrice==="49.00";
 return {status:expected?"matched-unattested-readback":"unverified",
  matchesDraftProduct:Boolean(expected),canFulfill:false,
  productId:PRODUCT_ID,moneyMovedByGatehouse:false,
  notice:"This is local shape validation only, not authenticated Shopify read-back, financial settlement or delivery permission."};
}
export function assessFulfillment(){
 return {service:"Hercules Gatehouse Website Health Diagnostic",status:"HOLD",
   offerPriceUSD:"49.00",shopifyProductStatus:"DRAFT",
   purchaseEnabled:false,deliveryAuthorized:false,subscriptionBillingEnabled:false,
   actualCustomerOrdersVerified:0,
   paidOrderReaderConnected:false,domainOwnershipVerified:false,
   safeCustomerProbeConnected:false,durableReportStoreConnected:false,
   customerIdentityTransportConnected:false,termsApprovedForOffer:false,
   missing:[...REQUIRED_GATES],
   note:"The existing public demo is not a customer report. No customer checkout, claim or fulfillment is activated through this Gatehouse service."};
}
export function makeSampleReport(summary={}){
 const time=Date.parse(summary?.refreshedAt);
 const observations=(Array.isArray(summary?.signals)?summary.signals:[])
 .filter(s=>KNOWN.has(s?.name)&&CONNECTIVITY.has(s?.status))
 .slice(0,4).map(s=>({service:s.name,connectivity:s.status}));
 return {schema:"hercules.gatehouse.demo-readiness.v1",sampleOnly:true,
  subject:"Hercules public endpoints (sample only)",
  testedAt:Number.isFinite(time)?new Date(time).toISOString():null,
  observations,customerDomainScanned:false,verifiedPaidOrder:false,
  customerDeliveryAuthorized:false,estimatedUptimePercent:null,
  paymentProcessorTested:false,refundTested:false,
  warning:"A read-only example of publicly observable service reachability, not an actual customer scan or commercial deliverable."};
}
