import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makePurchaseIntent} from "./purchase-link.mjs";
import {preparePrivateOrderCandidate} from "./order-candidate-ledger.mjs";
const owner="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const site="8388a570-7e32-4d63-9bee-9df0c877bbf9";
const intentId="aa88a570-7e32-4d63-9bee-9df0c877bbf9";
const secret=Buffer.alloc(32,0x34);
const time=Date.parse("2026-10-13T18:00:00.000Z");
const identity={id:owner,email:"buyer@example.com",emailConfirmedAt:"2026-10-13T17:00:00.000Z"};
const line=()=>({sku:"HG-DIAGNOSTIC-49",quantity:1,
 product:{id:"gid://shopify/Product/15424049283392"},
 variant:{id:"gid://shopify/ProductVariant/67754351460672"},
 originalUnitPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}}});
function setup(){
 const intent=makePurchaseIntent({ownerUserId:owner,siteId:site,secret,now:time,nonce:Buffer.alloc(24,0x12)});
 const privateIntent={...intent.privateRow,id:intentId};
 const order={id:"gid://shopify/Order/42",email:identity.email,test:false,cancelledAt:null,
  displayFinancialStatus:"PAID",currencyCode:"USD",
  totalPriceSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}},
  totalRefundedSet:{shopMoney:{amount:"0.00",currencyCode:"USD"}},
  lineItems:{pageInfo:{hasNextPage:false},nodes:[line()]},
  customAttributes:[{key:"gatehouse_intent_v1",value:intent.buyerReference}]};
 return {intent,privateIntent,order};
}
function prepare(change={}){
 const s=setup();
 return preparePrivateOrderCandidate({
  identity,intentRow:s.privateIntent,buyerReference:s.intent.buyerReference,
  requestedSiteId:site,order:s.order,secret,now:time+1000,...change
 });
}
test("eligible local candidate generates hashed private record but never paid authorization",()=>{
 const result=prepare();
 assert.equal(result.candidateMayBeRecorded,true);
 assert.equal(result.providerVerified,false);
 assert.equal(result.buyerIdentityVerifiedByProvider,false);
 assert.equal(result.customerEntitlementGranted,false);
 assert.equal(result.deliveryAuthorized,false);
 assert.equal(result.checkoutEnabled,false);
 assert.deepEqual(Object.keys(result.privateRow).sort(),
  ["intent_id","owner_user_id","site_id","order_hash","candidate_status","provider","item_unit_cents"].sort());
 assert.equal(result.privateRow.intent_id,intentId);
 assert.equal(result.privateRow.owner_user_id,owner);
 assert.equal(result.privateRow.site_id,site);
 assert.equal(result.privateRow.provider,"shopify");
 assert.equal(result.privateRow.item_unit_cents,4900);
 assert.equal(result.privateRow.candidate_status,"requires-provider-verification");
 assert.match(result.privateRow.order_hash,/^[0-9a-f]{64}$/);
 assert.doesNotMatch(JSON.stringify(result),/buyer@example\.com|gid:\/\/shopify\/Order|GH1-|reference_hash|secret/);
});
test("order hashes are stable per canonical order and secret, distinct across order IDs",()=>{
 const first=prepare(),second=prepare();
 assert.equal(first.privateRow.order_hash,second.privateRow.order_hash);
 const other=setup();
 other.order.id="gid://shopify/Order/43";
 const different=prepare({order:other.order});
 assert.notEqual(first.privateRow.order_hash,different.privateRow.order_hash);
 const another=prepare({secret:Buffer.alloc(32,0x42)});
 assert.equal(another.candidateMayBeRecorded,false);
});
test("wrong tenant, no confirmed email, wrong order, expiry, manipulated reference fail closed",()=>{
 const s=setup(),base={identity,intentRow:s.privateIntent,buyerReference:s.intent.buyerReference,
  requestedSiteId:site,order:s.order,secret,now:time+1000};
 const rejects=[
 {identity:{...identity,id:"11111111-1111-4111-8111-111111111111"}},
 {identity:{...identity,emailConfirmedAt:null}},
 {intentRow:{...s.privateIntent,id:"invalid"}},
 {intentRow:{...s.privateIntent,status:"consumed"}},
 {intentRow:{...s.privateIntent,owner_user_id:"22222222-2222-4222-8222-222222222222"}},
 {order:{...s.order,id:"invalid"}},
 {order:{...s.order,displayFinancialStatus:"PENDING"}},
 {order:{...s.order,totalRefundedSet:{shopMoney:{amount:"49.00",currencyCode:"USD"}}}},
 {requestedSiteId:"33333333-3333-4333-8333-333333333333"},
 {buyerReference:"GH1-"+"x".repeat(32)},
 {now:time+86400001},
 {secret:Buffer.alloc(8)}
 ];
 for(const change of rejects){
  const result=preparePrivateOrderCandidate({...base,...change});
  assert.equal(result.candidateMayBeRecorded,false,JSON.stringify(Object.keys(change)));
  assert.equal(result.privateRow,null);
  assert.equal(result.deliveryAuthorized,false);
 }
});
test("production SQL has private row-level security, unique order and intent, matching tenant FK, fixed HOLD status",()=>{
 const sql=readFileSync(new URL("../../supabase/gatehouse_order_candidate_ledger.sql",import.meta.url),"utf8");
 assert.match(sql,/create table public\.gatehouse_order_candidate_ledger/i);
 assert.match(sql,/unique\s*\(intent_id\)/i);
 assert.match(sql,/unique\s*\(order_hash\)/i);
 assert.match(sql,/foreign key\s*\(intent_id,\s*site_id,\s*owner_user_id\)/i);
 assert.match(sql,/references public\.gatehouse_purchase_intents\(id,\s*site_id,\s*owner_user_id\)/i);
 assert.match(sql,/check\s*\(candidate_status\s*=\s*'requires-provider-verification'\)/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.gatehouse_order_candidate_ledger from anon, authenticated/i);
 assert.doesNotMatch(sql,/^\s*grant\s+.*\s+to\s+(?:authenticated|anon)/im);
 assert.doesNotMatch(sql,/delivery_state\s*=\s*'released'/i);
});
