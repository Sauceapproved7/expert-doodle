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

/** Printable zero-trust public sample. Values come only from fixed allowlisted enums. */
export function renderPrintableSample(report){
 const rows=(report?.observations||[])
 .filter(x=>KNOWN.has(x?.service)&&CONNECTIVITY.has(x?.connectivity))
 .map(x=>'<tr><td>'+x.service+'</td><td>'+(x.connectivity==="reachable"?"Reachable":"No response")+'</td></tr>').join("");
 const time=typeof report?.testedAt==="string"?Date.parse(report.testedAt):NaN;
 const stamp=Number.isFinite(time)&&new Date(time).toISOString()===report.testedAt
  ?report.testedAt:"No verified observation";
 return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>Hercules Gatehouse — Sample Diagnostic Report</title>'+
  '<link rel="stylesheet" href="/report.css"></head><body><main>'+
  '<div class="kicker">SAUCEAPPROVED / HERCULES GATEHOUSE</div>'+
  '<h1>SAMPLE REPORT — NOT A CUSTOMER SCAN</h1>'+
  '<p class="warning">Public Hercules endpoint reachability only. This is not a paid deliverable, website audit, proof of security, uptime guarantee, or refund/settlement evidence.</p>'+
  '<p><strong>Observed:</strong> '+stamp+'</p>'+
  '<table><thead><tr><th>Hercules service</th><th>Network response</th></tr></thead><tbody>'+
  (rows||'<tr><td colspan="2">No public endpoint observations collected</td></tr>')+
  '</tbody></table><h2>Fulfillment state: HOLD</h2>'+
  '<p>No verified paid customer order. No customer domain scanned. No delivery permission.</p>'+
  '<p>Future real reports require signed customer authorization, verified paid Shopify order read-back, public-domain safety screening, and a secure delivery channel.</p>'+
  '<footer>Report is a sanitized illustrative sample. Production checkout, refunds, payouts and launch authorizations remain unchanged.</footer>'+
  '</main></body></html>';
}
