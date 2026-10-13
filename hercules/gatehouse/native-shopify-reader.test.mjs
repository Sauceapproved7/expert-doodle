import test from "node:test";
import assert from "node:assert/strict";
import {createNativeShopifyReader,NATIVE_SHOPIFY_QUERY} from "./native-shopify-reader.mjs";
const shopId="gid://shopify/Shop/100002726208",shopDomain="azymhc-x0.myshopify.com";
const token="temporary-test-token-value-32chars";
const line=()=>({sku:"HG-DIAGNOSTIC-49",quantity:1,
 product:{id:"gid://shopify/Product/15424049283392"},
 variant:{id:"gid://shopify/ProductVariant/67754351460672"},
 originalUnitPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}}});
const order=()=>({id:"gid://shopify/Order/123",test:false,cancelledAt:null,displayFinancialStatus:"PAID",
 currencyCode:"USD",totalPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}},
 totalRefundedSet:{shopMoney:{amount:"0.00",currencyCode:"USD"}},
 lineItems:{pageInfo:{hasNextPage:false},nodes:[line()]}});
const payload=(orders=[order()])=>({data:{shop:{id:shopId,myshopifyDomain:shopDomain},
 orders:{pageInfo:{hasNextPage:false,endCursor:null},edges:orders.map(node=>({node}))}}});
const fake=(data,code=200)=>({ok:code===200,status:code,json:async()=>data});
test("no backend grant, no explicit approval, no owner auth: zero requests and no entitlement",async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error("network must be blocked")};
 for(const args of [{},{enabled:true},{enabled:true,ownerAuthenticated:true},
  {enabled:true,accessToken:token},{ownerAuthenticated:true,accessToken:token}]){
  const r=await createNativeShopifyReader({fetcher,...args}).run();
  assert.equal(r.status,503);
  assert.equal(r.body.deliveryAuthorized,false);
  assert.equal(r.body.customerEntitlementGranted,false);
 }
 assert.equal(calls,0);
});
test("valid owner-authorized native order page verifies canonical store, sanitizes all order PII, does not fulfill",async()=>{
 const calls=[];
 const client=createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,
  fetcher:async(url,init)=>{calls.push({url,init});return fake(payload())}});
 const out=await client.run();
 assert.equal(out.status,200);
 assert.equal(out.body.candidateCount,1);
 assert.equal(out.body.ordersScanned,1);
 assert.equal(out.body.shopAuthenticated,true);
 assert.equal(out.body.source,"shopify-admin-live-readback");
 assert.equal(out.body.buyerIdentityVerified,false);
 assert.equal(out.body.deliveryAuthorized,false);
 assert.equal(out.body.customerEntitlementGranted,false);
 assert.equal(out.body.payoutVerified,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"https://azymhc-x0.myshopify.com/admin/api/2026-10/graphql.json");
 assert.equal(calls[0].init.method,"POST");
 assert.equal(calls[0].init.redirect,"error");
 assert.equal(calls[0].init.headers["X-Shopify-Access-Token"],token);
 const body=JSON.parse(calls[0].init.body);
 assert.equal(body.variables.first,10);
 assert.match(body.query,/shop\s*\{\s*id myshopifyDomain/);
 assert.doesNotMatch(JSON.stringify(out.body),/123|temporary-test-token|buyer@|Order\//);
});
test("invalid Shopify shop ID or domain disallows order results",async()=>{
 for(const change of [{id:"gid://shopify/Shop/123"},{myshopifyDomain:"malicious.myshopify.com"},
  {myshopifyDomain:"sauceapproved.com"},{myshopifyDomain:"sauceapproved-2.myshopify.com"},{id:null},{myshopifyDomain:null}]){
  const p=payload([]);Object.assign(p.data.shop,change);
  const r=await createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,fetcher:async()=>fake(p)}).run();
  assert.equal(r.status,503);assert.equal(r.body.shopAuthenticated,false);
  assert.equal(r.body.deliveryAuthorized,false);
 }
});
test("Shopify errors, rejection, malformation, bad HTTP and exceptions fail closed without secret echoes",async()=>{
 const failures=[
 async()=>fake({errors:[{message:"secret token hidden"}],data:payload().data}),
 async()=>fake({},401),
 async()=>fake({data:{shop:{id:shopId,myshopifyDomain:shopDomain},orders:null}}),
 async()=>fake({data:{shop:{id:shopId,myshopifyDomain:shopDomain},orders:{pageInfo:{hasNextPage:"false"},edges:[]}}}),
 async()=>{throw Error("provider leaked secret "+token)},
 async()=>({ok:true,status:200,json:async()=>{throw Error("payload error")}})
 ];
 for(const fetcher of failures){
  const r=await createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,fetcher}).run();
  assert.equal(r.status,503);
  assert.equal(r.body.deliveryAuthorized,false);
  assert.doesNotMatch(JSON.stringify(r),/secret token hidden|temporary-test-token|provider leaked/);
 }
});
test("duplicate Shopify order IDs fail the entire bounded observation closed",async()=>{
 const dup=order();
 const result=await createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,
  fetcher:async()=>fake(payload([dup,{...dup}]))}).run();
 assert.equal(result.status,503);
 assert.equal(result.body.error,"shopify-order-page-incomplete");
 assert.equal(result.body.shopAuthenticated,false);
 assert.equal(result.body.deliveryAuthorized,false);
 assert.equal(result.body.customerEntitlementGranted,false);
 assert.equal(result.body.candidateCount,undefined);
});
test("malformed or missing Shopify order GIDs never produce a success observation",async()=>{
 for(const invalid of [null,"", "gid://shopify/Order/0","gid://shopify/Order/abc","gid://shopify/Product/123"]){
  const bad={...order(),id:invalid};
  const result=await createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,
   fetcher:async()=>fake(payload([bad]))}).run();
  assert.equal(result.status,503,String(invalid));
  assert.equal(result.body.shopAuthenticated,false);
  assert.equal(result.body.deliveryAuthorized,false);
 }
});
test("distinct canonical Shopify order IDs preserve bounded candidate counts without delivery authority",async()=>{
 const second={...order(),id:"gid://shopify/Order/124"};
 const result=await createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,
  fetcher:async()=>fake(payload([order(),second]))}).run();
 assert.equal(result.status,200);
 assert.equal(result.body.ordersScanned,2);
 assert.equal(result.body.candidateCount,2);
 assert.equal(result.body.deliveryAuthorized,false);
 assert.equal(result.body.customerEntitlementGranted,false);
});
test("bad refunded, canceled, test, wrong variant, nonpaid orders are excluded",async()=>{
 const bad=[
 {...order(),test:true},{...order(),cancelledAt:"2026-10-13T15:00:00Z"},
 {...order(),displayFinancialStatus:"PENDING"},
 {...order(),totalRefundedSet:{shopMoney:{amount:"0.01",currencyCode:"USD"}}},
 {...order(),lineItems:{pageInfo:{hasNextPage:false},nodes:[{...line(),variant:{id:"gid://shopify/ProductVariant/1"}}]}}
 ];
 const r=await createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,fetcher:async()=>fake(payload(bad))}).run();
 assert.equal(r.status,200);assert.equal(r.body.candidateCount,0);assert.equal(r.body.ordersScanned,5);
 assert.equal(r.body.deliveryAuthorized,false);
});
test("bounded request only, no client PII, no GraphQL mutation or arbitrary URL",async()=>{
 assert.match(NATIVE_SHOPIFY_QUERY,/query GatehouseNativeOrders/);
 assert.match(NATIVE_SHOPIFY_QUERY,/orders\(first:\s*\$first/);
 assert.doesNotMatch(NATIVE_SHOPIFY_QUERY,/\bmutation\b|\bemail\b|\bcustomer\b|\bphone\b|\baddress\b|\btransactions\b/i);
 const out=await createNativeShopifyReader({enabled:true,ownerAuthenticated:true,accessToken:token,fetcher:async(_url,init)=>{
  assert.equal(JSON.parse(init.body).variables.first,10);
  return fake(payload([]));
 }}).run();
 assert.equal(out.status,200);assert.equal(out.body.candidateCount,0);
 assert.equal(out.body.allOrdersInLookbackVerified,false);
});
