import test from "node:test";
import assert from "node:assert/strict";
import {SHOPIFY_ORDER_QUERY, summarizeShopifyOrders, verifyOrderScope, productLineCandidate} from "../../supabase/functions/_shared/gatehouse-shopify-readback.mjs";

const line=()=>({id:"gid://shopify/LineItem/21",sku:"HG-DIAGNOSTIC-49",quantity:1,
  product:{id:"gid://shopify/Product/15424049283392"},
  variant:{id:"gid://shopify/ProductVariant/67754351460672"},
  originalUnitPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}}});
const order=()=>({id:"gid://shopify/Order/42",test:false,cancelledAt:null,
 displayFinancialStatus:"PAID",currencyCode:"USD",
 totalPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}},
 totalRefundedSet:{shopMoney:{amount:"0.00",currencyCode:"USD"}},
 lineItems:{pageInfo:{hasNextPage:false},nodes:[line()]}
});
test("bounded GraphQL query never requests PII or provider writes",()=>{
 assert.match(SHOPIFY_ORDER_QUERY,/orders\(first:\s*\$first/);
 assert.match(SHOPIFY_ORDER_QUERY,/pageInfo/);
 assert.doesNotMatch(SHOPIFY_ORDER_QUERY,/\b(email|phone|address|customer|transactions|mutation)\b/i);
});
test("empty authenticated order page reports zero candidates without fabricating purchases",()=>{
 const r=summarizeShopifyOrders({orders:{pageInfo:{hasNextPage:false,endCursor:null},edges:[]}});
 assert.equal(r.candidateCount,0);
 assert.equal(r.ordersScanned,0);
 assert.equal(r.allOrdersInLookbackVerified,false);
 assert.equal(r.deliveryAuthorized,false);
 assert.equal(r.payoutVerified,false);
 assert.equal(r.providerIdentityVerified,false);
});
test("matching Shopify order is candidate for owner reconciliation, never entitlement",()=>{
 const r=summarizeShopifyOrders({orders:{pageInfo:{hasNextPage:false,endCursor:null},edges:[{node:order()}]}});
 assert.equal(r.candidateCount,1);
 assert.equal(r.candidates[0].status,"readback-candidate-only");
 assert.equal(r.candidates[0].productCode,"gatehouse-diagnostic-49");
 assert.equal(r.deliveryAuthorized,false);
 assert.equal(r.checkoutModified,false);
 assert.doesNotMatch(JSON.stringify(r),/email|address|x-shopify|client_secret/i);
});
test("reject test refunds cancellations wrong SKU, price, product, quantity, extra cart lines",()=>{
 const bad=[
 {test:true},{cancelledAt:"2026-10-13T00:00:00Z"},{displayFinancialStatus:"PENDING"},
 {currencyCode:"EUR"},{totalPriceSet:{shopMoney:{amount:"48.00",currencyCode:"USD"}}},
 {totalRefundedSet:{shopMoney:{amount:"0.01",currencyCode:"USD"}}},
 {lineItems:{pageInfo:{hasNextPage:true},nodes:[line()]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),sku:"WRONG"}]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),quantity:2}]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),variant:{id:"gid://shopify/ProductVariant/123"}}]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),product:{id:"gid://shopify/Product/1"}}]}},
 {lineItems:{pageInfo:{hasNextPage:false},nodes:[line(),line()]}}
 ];
 for(const change of bad)assert.equal(productLineCandidate({...order(),...change}),false,JSON.stringify(change));
});
test("untrusted missing pageInfo or partial order data is a hard failure",()=>{
 assert.throws(()=>summarizeShopifyOrders({}));
 assert.throws(()=>summarizeShopifyOrders({orders:{edges:[]}}));
 assert.throws(()=>summarizeShopifyOrders({orders:{edges:[{}],pageInfo:{hasNextPage:false}}}));
 assert.throws(()=>summarizeShopifyOrders({orders:{edges:[],pageInfo:{hasNextPage:"false"}}}));
});
test("scope must be canonical store with exact active connected organization",()=>{
 assert.equal(verifyOrderScope({provider:"shopify",shopDomain:"sauceapproved-2.myshopify.com",connectionStatus:"active",membershipActive:true,role:"owner"}),true);
 for(const change of [{shopDomain:"someother.myshopify.com"},{connectionStatus:"pending"},{membershipActive:false},{role:"viewer"},{provider:"stripe"}])
  assert.equal(verifyOrderScope({provider:"shopify",shopDomain:"sauceapproved-2.myshopify.com",connectionStatus:"active",membershipActive:true,role:"owner",...change}),false);
});
