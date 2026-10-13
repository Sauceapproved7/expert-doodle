import test from "node:test";
import assert from "node:assert/strict";
import {makePurchaseIntent} from "./purchase-link.mjs";
import {createPrivateBuyerOrderReader,PRIVATE_BUYER_ORDER_QUERY} from "./private-buyer-order-reader.mjs";

const owner="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const site="8388a570-7e32-4d63-9bee-9df0c877bbf9";
const id="aa88a570-7e32-4d63-9bee-9df0c877bbf9";
const secret=Buffer.alloc(32,0x34);
const token="test-only-provider-token-12345678901234567890";
const now=Date.parse("2026-10-13T18:00:00.000Z");
const identity={id:owner,email:"buyer@example.com",emailConfirmedAt:"2026-10-13T17:00:00.000Z"};
const line=()=>({sku:"HG-DIAGNOSTIC-49",quantity:1,product:{id:"gid://shopify/Product/15424049283392"},
 variant:{id:"gid://shopify/ProductVariant/67754351460672"},
 originalUnitPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}}});
function setup(){
 const purchase=makePurchaseIntent({ownerUserId:owner,siteId:site,secret,now,nonce:Buffer.alloc(24,0x12)});
 const intentRow={...purchase.privateRow,id};
 const order={id:"gid://shopify/Order/42",test:false,cancelledAt:null,email:identity.email,
  displayFinancialStatus:"PAID",currencyCode:"USD",
  totalPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}},
  totalRefundedSet:{shopMoney:{amount:"0.00",currencyCode:"USD"}},
  lineItems:{pageInfo:{hasNextPage:false},nodes:[line()]},
  customAttributes:[{key:"gatehouse_intent_v1",value:purchase.buyerReference}]};
 const input={enabled:true,ownerAuthenticated:true,accessToken:token,identity,intentRow,
  buyerReference:purchase.buyerReference,requestedSiteId:site,secret,now:now+1000};
 return {input,order};
}
const page=(orders,shop={id:"gid://shopify/Shop/100002726208",myshopifyDomain:"azymhc-x0.myshopify.com"})=>({
 data:{shop,orders:{pageInfo:{hasNextPage:false,endCursor:null},edges:orders.map(node=>({node}))}}});
const fake=(body,status=200)=>({ok:status===200,status,json:async()=>body});
test("disabled, unauthenticated, or missing token: no request, no candidate, no fulfillment",async()=>{
 const s=setup();let calls=0;
 const fetcher=async()=>{calls++;throw new Error("must never reach network")};
 for(const change of [{enabled:false},{ownerAuthenticated:false},{accessToken:""},
  {secret:null},{intentRow:null},{identity:null},{requestedSiteId:null}]){
  const r=await createPrivateBuyerOrderReader({...s.input,...change,fetcher}).run();
  assert.equal(r.status,503);
  assert.equal(r.body.candidateMayBeRecorded,false);
  assert.equal(r.body.deliveryAuthorized,false);
 }
 assert.equal(calls,0);
});
test("authenticated exact buyer + site + purchase reference yields only a hashed, withheld proposal",async()=>{
 const s=setup(),calls=[];
 const r=await createPrivateBuyerOrderReader({...s.input,
  fetcher:async(url,init)=>{calls.push({url,init});return fake(page([s.order]));}}).run();
 assert.equal(r.status,200);
 assert.equal(r.body.status,"private-candidate-proposal-only");
 assert.equal(r.body.shopAuthenticated,true);
 assert.equal(r.body.ordersScanned,1);
 assert.equal(r.body.candidateMayBeRecorded,true);
 assert.equal(r.body.providerVerified,false);
 assert.equal(r.body.customerEntitlementGranted,false);
 assert.equal(r.body.deliveryAuthorized,false);
 assert.equal(r.body.checkoutEnabled,false);
 assert.deepEqual(Object.keys(r.body.privateRow).sort(),
  ["intent_id","owner_user_id","site_id","order_hash","candidate_status","provider","item_unit_cents"].sort());
 assert.match(r.body.privateRow.order_hash,/^[a-f0-9]{64}$/);
 assert.equal(r.body.privateRow.owner_user_id,owner);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"https://azymhc-x0.myshopify.com/admin/api/2026-10/graphql.json");
 assert.equal(calls[0].init.redirect,"error");
 assert.equal(calls[0].init.method,"POST");
 assert.equal(calls[0].init.headers["X-Shopify-Access-Token"],token);
 assert.equal(JSON.parse(calls[0].init.body).variables.first,10);
 assert.doesNotMatch(JSON.stringify(r.body),/buyer@example|GH1-|gid:\/\/shopify\/Order|test-only-provider-token/);
});
test("buyer mismatch, wrong reference, payment/refund/test fraud and mixed cart produce no candidate",async()=>{
 const s=setup();
 const changed=[
  {...s.order,email:"another@example.com"},
  {...s.order,customAttributes:[]},
  {...s.order,displayFinancialStatus:"PENDING"},
  {...s.order,test:true},
  {...s.order,cancelledAt:"2026-10-13T18:00:00Z"},
  {...s.order,totalRefundedSet:{shopMoney:{amount:"0.01",currencyCode:"USD"}}},
  {...s.order,lineItems:{pageInfo:{hasNextPage:true},nodes:[line()]}},
  {...s.order,lineItems:{pageInfo:{hasNextPage:false},nodes:[line(),line()]}}
 ];
 for(const order of changed){
  const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(page([order]))}).run();
  assert.equal(r.status,200);
  assert.equal(r.body.candidateMayBeRecorded,false);
  assert.equal(r.body.privateRow,null);
  assert.equal(r.body.deliveryAuthorized,false);
 }
});
test("wrong shop, duplicate IDs, malformed IDs, oversized pages and provider exceptions fail closed",async()=>{
 const s=setup();
 const bad=[
  page([s.order],{id:"gid://shopify/Shop/999",myshopifyDomain:"azymhc-x0.myshopify.com"}),
  page([s.order,{...s.order}]),
  page([{...s.order,id:"gid://shopify/Order/garbage"}]),
  page(Array.from({length:11},(_,i)=>({...s.order,id:"gid://shopify/Order/"+(i+20)}))),
  {errors:[{message:"sensitive backend token"}],data:page([s.order]).data}
 ];
 for(const response of bad){
  const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(response)}).run();
  assert.equal(r.status,503);
  assert.equal(r.body.shopAuthenticated,false);
  assert.equal(r.body.candidateMayBeRecorded,false);
  assert.equal(r.body.privateRow,null);
  assert.equal(r.body.deliveryAuthorized,false);
  assert.doesNotMatch(JSON.stringify(r.body),/buyer@example|Order\/|sensitive backend token/);
 }
 const r=await createPrivateBuyerOrderReader({...s.input,
  fetcher:async()=>{throw Error("leak "+token)}}).run();
 assert.equal(r.status,503);
 assert.doesNotMatch(JSON.stringify(r.body),/leak|test-only-provider-token/);
});
test("Shopify protected customer email denial is a distinct private HOLD, even on HTTP 200",async()=>{
 const s=setup();
 const denied={...page([s.order]),errors:[{
  message:"This app is not approved to use the email field.",
  path:["orders","edges",0,"node","email"],extensions:{code:"ACCESS_DENIED"}
 }]};
 const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(denied)}).run();
 assert.equal(r.status,503);
 assert.equal(r.body.error,"shopify-protected-customer-email-unavailable");
 assert.equal(r.body.shopAuthenticated,false);
 assert.equal(r.body.candidateMayBeRecorded,false);
 assert.equal(r.body.privateRow,null);
 assert.equal(r.body.deliveryAuthorized,false);
 assert.equal(r.body.customerEntitlementGranted,false);
 assert.doesNotMatch(JSON.stringify(r.body),/buyer@example|GH1-|Order\/|This app is not approved|test-only-provider-token/);
});
test("non-email GraphQL access denial never mislabels protected customer email approval",async()=>{
 const s=setup();
 const denied={...page([s.order]),errors:[{
  message:"Access denied for orders field",path:["orders"],extensions:{code:"ACCESS_DENIED"}
 }]};
 const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(denied)}).run();
 assert.equal(r.status,503);
 assert.equal(r.body.error,"shopify-shop-attestation-unavailable");
 assert.equal(r.body.candidateMayBeRecorded,false);
 assert.equal(r.body.deliveryAuthorized,false);
});
test("redacted null email without GraphQL errors cannot match a verified buyer",async()=>{
 const s=setup();
 const redacted={...s.order,email:null};
 const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(page([redacted]))}).run();
 assert.equal(r.status,200);
 assert.equal(r.body.candidateMayBeRecorded,false);
 assert.equal(r.body.privateRow,null);
 assert.equal(r.body.deliveryAuthorized,false);
});
test("two distinct paid orders claiming same reference are ambiguous and cannot reserve a candidate",async()=>{
 const s=setup();
 const r=await createPrivateBuyerOrderReader({...s.input,
  fetcher:async()=>fake(page([s.order,{...s.order,id:"gid://shopify/Order/43"}]))}).run();
 assert.equal(r.status,503);
 assert.equal(r.body.candidateMayBeRecorded,false);
 assert.equal(r.body.privateRow,null);
});
test("no match and truncated lookback do not claim no lifetime order, delivery stays held",async()=>{
 const s=setup(),pages=[0,1,2].map(n=>{
  const p=page([{...s.order,id:"gid://shopify/Order/"+(300+n),customAttributes:[]}]);
  p.data.orders.pageInfo={hasNextPage:true,endCursor:"cursor-no-match-"+n};
  return p;
 });
 let calls=0;
 const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(pages[calls++])}).run();
 assert.equal(calls,3);
 assert.equal(r.status,200);
 assert.equal(r.body.candidateMayBeRecorded,false);
 assert.equal(r.body.ordersScanned,3);
 assert.equal(r.body.hasNextPage,true);
 assert.equal(r.body.allOrdersVerified,false);
 assert.equal(r.body.deliveryAuthorized,false);
});
test("expired, future, mismatched or unverified private buyer intents never contact Shopify",async()=>{
 const s=setup();let requests=0;
 const fetcher=async()=>{requests++;throw Error("private invalid inputs must never reach provider")};
 const invalid=[
  {now:now+86400001},
  {intentRow:{...s.input.intentRow,expires_at:"invalid"}},
  {intentRow:{...s.input.intentRow,expires_at:new Date(now+3*86400000).toISOString()}},
  {intentRow:{...s.input.intentRow,reference_hash:"a".repeat(64)}},
  {intentRow:{...s.input.intentRow,reference_hash:"invalid-hash"}},
  {buyerReference:"GH1-"+"Z".repeat(32)},
  {identity:{...s.input.identity,emailConfirmedAt:null}},
  {identity:{...s.input.identity,emailConfirmedAt:new Date(now+9000).toISOString()}},
  {identity:{...s.input.identity,email:"not-an-email"}}
 ];
 for(const change of invalid){
  const result=await createPrivateBuyerOrderReader({...s.input,...change,fetcher}).run();
  assert.equal(result.status,503,JSON.stringify(change));
  assert.equal(result.body.shopAuthenticated,false);
  assert.equal(result.body.candidateMayBeRecorded,false);
  assert.equal(result.body.privateRow,null);
  assert.equal(result.body.deliveryAuthorized,false);
 }
 assert.equal(requests,0);
});
test("a matching order in incomplete three-page history cannot reserve a candidate",async()=>{
 const s=setup(),pages=[0,1,2].map(n=>{
  const p=page([n===0?s.order:{...s.order,id:"gid://shopify/Order/"+(400+n),customAttributes:[]}]);
  p.data.orders.pageInfo={hasNextPage:true,endCursor:"cursor-matching-"+n};
  return p;
 });
 let calls=0;
 const result=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(pages[calls++])}).run();
 assert.equal(calls,3);
 assert.equal(result.status,200);
 assert.equal(result.body.shopAuthenticated,true);
 assert.equal(result.body.ordersScanned,3);
 assert.equal(result.body.hasNextPage,true);
 assert.equal(result.body.candidateMayBeRecorded,false);
 assert.equal(result.body.privateRow,null);
 assert.equal(result.body.allOrdersVerified,false);
 assert.equal(result.body.deliveryAuthorized,false);
 assert.notEqual(result.body.status,"private-candidate-proposal-only");
});

test("second-page real Shopify order is found with an authenticated cursor only after complete readback",async()=>{
 const s=setup(),requests=[];
 const p1=page(Array.from({length:10},(_,i)=>({...s.order,id:"gid://shopify/Order/"+(100+i),customAttributes:[]})));
 p1.data.orders.pageInfo={hasNextPage:true,endCursor:"opaque-shopify-cursor-p1"};
 const p2=page([s.order]);
 const fetcher=async(url,options)=>{
  requests.push({url,options});
  return fake(requests.length===1?p1:p2);
 };
 const r=await createPrivateBuyerOrderReader({...s.input,fetcher}).run();
 assert.equal(r.status,200);
 assert.equal(r.body.candidateMayBeRecorded,true);
 assert.equal(r.body.ordersScanned,11);
 assert.equal(r.body.hasNextPage,false);
 assert.equal(r.body.deliveryAuthorized,false);
 assert.equal(r.body.providerVerified,false);
 assert.equal(requests.length,2);
 const first=JSON.parse(requests[0].options.body).variables;
 const second=JSON.parse(requests[1].options.body).variables;
 assert.equal(first.first,10);
 assert.equal(first.after,null);
 assert.equal(second.first,10);
 assert.equal(second.after,"opaque-shopify-cursor-p1");
 for(const call of requests) {
  assert.equal(call.url,"https://azymhc-x0.myshopify.com/admin/api/2026-10/graphql.json");
  assert.equal(call.options.headers["X-Shopify-Access-Token"],token);
  assert.equal(call.options.redirect,"error");
  assert.equal(call.options.method,"POST");
 }
 assert.doesNotMatch(JSON.stringify(r.body),/buyer@example|GH1-|gid:\/\/shopify\/Order|test-only-provider-token|opaque-shopify-cursor/);
});
test("three pages are the ceiling and a fourth unobserved page always withholds candidate",async()=>{
 const s=setup(),requests=[];
 const make=(number,hasNextPage)=>{
  const p=page([{...s.order,id:"gid://shopify/Order/"+number,
   customAttributes:number===100?s.order.customAttributes:[]}]);
  p.data.orders.pageInfo={hasNextPage,endCursor:"page-"+number};
  return p;
 };
 const pages=[make(100,true),make(101,true),make(102,true)];
 const r=await createPrivateBuyerOrderReader({...s.input,
  fetcher:async(_url,opt)=>{requests.push(JSON.parse(opt.body).variables);return fake(pages[requests.length-1]);}
 }).run();
 assert.equal(requests.length,3);
 assert.deepEqual(requests.map(x=>x.after),[null,"page-100","page-101"]);
 assert.equal(r.status,200);
 assert.equal(r.body.status,"incomplete-provider-lookback");
 assert.equal(r.body.ordersScanned,3);
 assert.equal(r.body.hasNextPage,true);
 assert.equal(r.body.allOrdersVerified,false);
 assert.equal(r.body.candidateMayBeRecorded,false);
 assert.equal(r.body.privateRow,null);
 assert.equal(r.body.deliveryAuthorized,false);
});
test("candidate in first page cannot escape conflicting second-page order",async()=>{
 const s=setup(),calls=[];
 const p1=page([s.order]);
 p1.data.orders.pageInfo={hasNextPage:true,endCursor:"cursor-1"};
 const p2=page([{...s.order,id:"gid://shopify/Order/43"}]);
 const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async(_u,opts)=>{
  calls.push(JSON.parse(opts.body).variables);return fake(calls.length===1?p1:p2);
 }}).run();
 assert.equal(calls.length,2);
 assert.equal(r.status,503);
 assert.equal(r.body.candidateMayBeRecorded,false);
 assert.equal(r.body.privateRow,null);
 assert.equal(r.body.deliveryAuthorized,false);
});
test("missing or repeated Shopify next-page cursor and duplicate cross-page order fail closed",async()=>{
 const s=setup();
 for(const mode of ["missing","empty","control","repeat","cross-page-duplicate"]){
  const p1=page([s.order]);
  p1.data.orders.pageInfo={hasNextPage:true,endCursor:mode==="missing"?null:mode==="empty"?"":mode==="control"?"bad\ncursor":"first-cursor"};
  const p2=page([{...s.order,id:mode==="cross-page-duplicate"?s.order.id:"gid://shopify/Order/43",customAttributes:[]}]);
  p2.data.orders.pageInfo={hasNextPage:mode==="repeat",endCursor:"first-cursor"};
  let calls=0;
  const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>fake(++calls===1?p1:p2)}).run();
  assert.equal(r.status,503,mode);
  assert.equal(r.body.candidateMayBeRecorded,false);
  assert.equal(r.body.privateRow,null);
  assert.equal(r.body.deliveryAuthorized,false);
  assert.equal(r.body.shopAuthenticated,false);
  assert.ok(calls<=2,mode);
 }
});
test("no new Shopify cursor on second page if first page is final",async()=>{
 const s=setup();let count=0;
 const r=await createPrivateBuyerOrderReader({...s.input,fetcher:async()=>{count++;return fake(page([s.order]));}}).run();
 assert.equal(r.status,200);
 assert.equal(r.body.candidateMayBeRecorded,true);
 assert.equal(count,1);
});

test("buyer readback is a bounded private read-only query, never sends PII to a public return",()=>{
 assert.match(PRIVATE_BUYER_ORDER_QUERY,/shop \{ id myshopifyDomain \}/);
 assert.match(PRIVATE_BUYER_ORDER_QUERY,/customAttributes \{ key value \}/);
 assert.match(PRIVATE_BUYER_ORDER_QUERY,/email test cancelledAt/);
 assert.doesNotMatch(PRIVATE_BUYER_ORDER_QUERY,/\bmutation\b|refundCreate|fulfillmentCreate/);
});
