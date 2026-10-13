import test from "node:test";
import assert from "node:assert/strict";
import {REQUIRED_GATES,assessFulfillment,makeSampleReport,renderPrintableSample,checkOrderReadback} from "./fulfillment.mjs";

const validOrder=()=>({
 orderId:"gid://shopify/Order/12345",shopDomain:"sauceapproved-2.myshopify.com",
 currencyCode:"USD",totalPrice:"49.00",financialStatus:"PAID",
 cancelledAt:null,refundTotal:"0.00",fulfillmentStatus:"UNFULFILLED",
 lineItems:[{productId:"gid://shopify/Product/15424049283392",
  variantId:"gid://shopify/ProductVariant/67754351460672",sku:"HG-DIAGNOSTIC-49",quantity:1,unitPrice:"49.00"}]
});
test("commerce defaults permanently to HOLD when no authorized delivery adapters exist",()=>{
 const s=assessFulfillment();
 assert.equal(s.status,"HOLD");
 assert.equal(s.purchaseEnabled,false);
 assert.equal(s.deliveryAuthorized,false);
 assert.equal(s.subscriptionBillingEnabled,false);
 assert.equal(s.actualCustomerOrdersVerified,0);
 assert.equal(s.missing.length,REQUIRED_GATES.length);
});
test("verified-looking flags supplied as data cannot unlock a real sale or delivery",()=>{
 const injected=Object.fromEntries(REQUIRED_GATES.map(x=>[x,true]));
 const s=assessFulfillment({order:validOrder(),verified:true,ready:true,approval:true,...injected});
 assert.equal(s.status,"HOLD");
 assert.equal(s.purchaseEnabled,false);
 assert.equal(s.deliveryAuthorized,false);
 assert.equal(s.subscriptionBillingEnabled,false);
});
test("exact one-item order candidate still needs an authorized shopify server readback",()=>{
 const result=checkOrderReadback(validOrder());
 assert.equal(result.matchesDraftProduct,true);
 assert.equal(result.canFulfill,false);
 assert.equal(result.status,"matched-unattested-readback");
 assert.equal(result.moneyMovedByGatehouse,false);
 assert.equal(result.productId,"gid://shopify/Product/15424049283392");
});
test("wrong currency, SKU, variant, order status, refunds, cancellation and mixed carts reject",()=>{
 const bad=[
  {currencyCode:"EUR"},{totalPrice:"50.00"},{financialStatus:"PENDING"},
  {refundTotal:"1.00"},{cancelledAt:"2026-10-13T11:00:00Z"},
  {shopDomain:"other.myshopify.com"},
  {lineItems:[{...validOrder().lineItems[0],sku:"OTHER"}]},
  {lineItems:[{...validOrder().lineItems[0],variantId:"gid://shopify/ProductVariant/1"}]},
  {lineItems:[{...validOrder().lineItems[0],quantity:2}]},
  {lineItems:[...validOrder().lineItems,{...validOrder().lineItems[0],quantity:1}]},
  {lineItems:[]},
 ];
 for(const mod of bad){
  const r=checkOrderReadback({...validOrder(),...mod});
  assert.equal(r.matchesDraftProduct,false,JSON.stringify(mod));
  assert.equal(r.canFulfill,false);
 }
});
test("sample report serializes only approved service names and status, no raw headers or IDs",()=>{
 const report=makeSampleReport({
  refreshedAt:"2026-10-13T12:30:00.000Z",
  signals:[
   {name:"Smallz",status:"unreachable",authorization:"Bearer very-secret",url:"https://private"},
   {name:"Studio",status:"reachable",cookie:"secret"},
   {name:"Stripe",status:"reachable",customerId:123},
   {name:"Hercules MCP",status:"bad",token:"secret"}
  ]
 });
 assert.equal(report.sampleOnly,true);
 assert.equal(report.customerDomainScanned,false);
 assert.equal(report.verifiedPaidOrder,false);
 assert.equal(report.customerDeliveryAuthorized,false);
 assert.equal(report.estimatedUptimePercent,null);
 assert.equal(report.testedAt,"2026-10-13T12:30:00.000Z");
 assert.deepEqual(report.observations,[{service:"Smallz",connectivity:"unreachable"},{service:"Studio",connectivity:"reachable"}]);
 assert.doesNotMatch(JSON.stringify(report),/very-secret|Bearer|private|customerId/);
});
test("invalid report timestamps do not manufacture a time or customer scan",()=>{
 const r=makeSampleReport({refreshedAt:"bad",signals:[{name:"Unknown",status:"reachable"}]});
 assert.equal(r.testedAt,null);
 assert.deepEqual(r.observations,[]);
 assert.equal(r.customerDomainScanned,false);
});

test("printable report does not reflect forged timestamps or arbitrary HTML",()=>{
 const report=makeSampleReport({refreshedAt:"2026-10-13T12:00:00.000Z",signals:[{name:"Studio",status:"reachable"}]});
 const attack={...report,testedAt:'2026-10-13T12:00:00Z<img src=x onerror=alert(1)>',observations:[{service:'<script>',connectivity:"reachable"},{service:"Studio",connectivity:"reachable"}]};
 const html=renderPrintableSample(attack);
 assert.match(html,/No verified observation/);
 assert.doesNotMatch(html,/<script>|<img/);
 assert.match(html,/Studio/);
});
