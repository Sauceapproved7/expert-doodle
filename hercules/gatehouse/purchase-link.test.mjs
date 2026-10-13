import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makePurchaseIntent,assessPurchaseCandidate,SHOPIFY_PURCHASE_QUERY,buildPurchaseLinkReadiness} from "./purchase-link.mjs";

const owner="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const siteId="8388a570-7e32-4d63-9bee-9df0c877bbf9";
const secret=Buffer.alloc(32,0x34);
const now=Date.parse("2026-10-13T18:00:00.000Z");
const identity={id:owner,email:"buyer@example.com",emailConfirmedAt:"2026-10-13T17:00:00.000Z"};
const line=()=>({sku:"HG-DIAGNOSTIC-49",quantity:1,
 product:{id:"gid://shopify/Product/15424049283392"},
 variant:{id:"gid://shopify/ProductVariant/67754351460672"},
 originalUnitPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}}});
function setup(){
 return makePurchaseIntent({ownerUserId:owner,siteId,secret,now,nonce:Buffer.alloc(24,0x11)});
}
function order(intent){
 return {id:"gid://shopify/Order/42",test:false,cancelledAt:null,
  email:"buyer@example.com",displayFinancialStatus:"PAID",currencyCode:"USD",
  totalPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}},
  totalRefundedSet:{shopMoney:{amount:"0.00",currencyCode:"USD"}},
  lineItems:{pageInfo:{hasNextPage:false},nodes:[line()]},
  customAttributes:[{key:"gatehouse_intent_v1",value:intent.buyerReference}]};
}
test("random future reference is opaque, tenant-bound, short lived, never accepts money",()=>{
 const x=setup();
 assert.match(x.buyerReference,/^GH1-[A-Za-z0-9_-]{32}$/);
 assert.doesNotMatch(x.buyerReference,/buyer|example\.com|0388|8388/);
 assert.equal(x.privateRow.owner_user_id,owner);
 assert.equal(x.privateRow.site_id,siteId);
 assert.match(x.privateRow.reference_hash,/^[0-9a-f]{64}$/);
 assert.equal(x.privateRow.status,"awaiting-provider-readback");
 assert.equal(x.privateRow.expires_at,"2026-10-14T18:00:00.000Z");
 assert.doesNotMatch(JSON.stringify(x.privateRow),/buyer@example|GH1-/);
 assert.equal(x.checkoutCreated,false);
 assert.equal(x.deliveryAuthorized,false);
 assert.equal(x.customerEntitlementGranted,false);
});
test("validated shapes are candidates ONLY, not proof of Shopify authenticity or buyer delivery",()=>{
 const intent=setup();
 const x=assessPurchaseCandidate({identity,intentRow:intent.privateRow,
  buyerReference:intent.buyerReference,requestedSiteId:siteId,order:order(intent),secret,now:now+1000});
 assert.equal(x.status,"candidate-needs-authoritative-readback");
 assert.equal(x.localChecksMatched,true);
 assert.equal(x.providerReadbackVerified,false);
 assert.equal(x.buyerIdentityVerifiedByProvider,false);
 assert.equal(x.deliveryAuthorized,false);
 assert.equal(x.customerEntitlementGranted,false);
 assert.equal(x.orderId,"gid://shopify/Order/42");
 assert.doesNotMatch(JSON.stringify(x),/buyer@example|reference_hash|GH1-/);
});
test("unpaid, refunded, test, canceled, partial, wrong product/currency, and conflicting carts fail closed",()=>{
 const intent=setup(),base=order(intent);
 const cases=[
 {test:true},{cancelledAt:"2026-10-13T18:00:00.000Z"},{email:"other@example.com"},
 {displayFinancialStatus:"PENDING"},{displayFinancialStatus:"PARTIALLY_PAID"},
 {currencyCode:"EUR"},{totalPriceSet:{shopMoney:{amount:"48.99",currencyCode:"USD"}}},
 {totalRefundedSet:{shopMoney:{amount:"0.01",currencyCode:"USD"}}},
 {lineItems:{pageInfo:{hasNextPage:true},nodes:[line()]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),sku:"OTHER"}]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),quantity:2}]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),variant:{id:"gid://shopify/ProductVariant/3"}}]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[line(),line()]}},
 {customAttributes:[]},
 {customAttributes:[{key:"gatehouse_intent_v1",value:"forged"}]},
 {customAttributes:[{key:"gatehouse_intent_v1",value:intent.buyerReference},{key:"gatehouse_intent_v1",value:intent.buyerReference}]}
 ];
 for(const change of cases){
  const result=assessPurchaseCandidate({identity,intentRow:intent.privateRow,
   buyerReference:intent.buyerReference,requestedSiteId:siteId,order:{...base,...change},secret,now});
  assert.equal(result.localChecksMatched,false,JSON.stringify(change));
  assert.equal(result.deliveryAuthorized,false);
 }
});
test("wrong identity, missing provider-verified email claims, expired/forged reference fail closed",()=>{
 const intent=setup(),rawOrder=order(intent);
 const cases=[
 {identity:{...identity,id:"1888a570-7e32-4d63-9bee-9df0c877bbf9"}},
 {identity:{...identity,emailConfirmedAt:null}},
 {identity:{...identity,email:"other@example.com"}},
 {buyerReference:"GH1-"+"A".repeat(32)},
 {secret:Buffer.alloc(32,0x12)},
 {now:now+86400001},
 {intentRow:{...intent.privateRow,site_id:"00000000-0000-4000-8000-000000000000"}},
 {intentRow:{...intent.privateRow,status:"consumed"}},
 {order:{...rawOrder,email:null}}
 ];
 for(const change of cases){
  const result=assessPurchaseCandidate({identity,intentRow:intent.privateRow,
   buyerReference:intent.buyerReference,requestedSiteId:siteId,order:rawOrder,secret,now, ...change});
  assert.equal(result.localChecksMatched,false);
  assert.equal(result.customerEntitlementGranted,false);
 }
});
test("Shopify GraphQL read operation is schema-validated and query itself has no mutations",()=>{
 assert.match(SHOPIFY_PURCHASE_QUERY,/orders\(first:\s*\$first/);
 assert.match(SHOPIFY_PURCHASE_QUERY,/customAttributes \{ key value \}/);
 assert.match(SHOPIFY_PURCHASE_QUERY,/email test cancelledAt displayFinancialStatus/);
 assert.doesNotMatch(SHOPIFY_PURCHASE_QUERY,/\bmutation\b|fulfillmentCreate|refundCreate|draftOrderCreate/);
 const state=buildPurchaseLinkReadiness({allGatesApproved:true,sourceConnected:true});
 assert.equal(state.status,"HOLD");
 assert.equal(state.nativeShopifyReaderConnected,false);
 assert.equal(state.purchaseEnabled,false);
 assert.equal(state.orderToBuyerLinkVerified,false);
 assert.equal(state.deliveryAuthorized,false);
});
test("schema holds claims as private, unfulfilled rows with customer-owned foreign key",()=>{
 const sql=readFileSync(new URL("../../supabase/gatehouse_purchase_intents.sql",import.meta.url),"utf8");
 assert.match(sql,/create table public\.gatehouse_purchase_intents/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/foreign key \(site_id, owner_user_id\)/i);
 assert.match(sql,/status text not null default 'awaiting-provider-readback'/i);
 assert.match(sql,/check \(status = 'awaiting-provider-readback'\)/i);
 assert.match(sql,/reference_hash text not null unique/i);
 assert.doesNotMatch(sql,/^\s*grant[^\n]*to (?:anon|authenticated)/im);
 assert.doesNotMatch(sql,/^\s*alter table .*disable row level security/im);
});
