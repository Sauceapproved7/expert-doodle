import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCustomerRequest,buildTenantSiteRow,assessDelivery,publicAccountState} from "./client-onboarding.mjs";

const userId="0388a570-7e32-4d63-9bee-9df0c877bbf9";
test("authorized customer website request returns minimum consented, non-financial data",()=>{
 const input={website:"https://sample.example.com",authorized:true,consentVersion:"gatehouse-diagnostic-v1",unexpectedField:"SECRET"};
 const result=normalizeCustomerRequest(input);
 assert.deepEqual(result,{
  origin:"https://sample.example.com",
  authorized:true,consentVersion:"gatehouse-diagnostic-v1",
  stage:"awaiting-domain-control"
 });
 assert.doesNotMatch(JSON.stringify(result),/SECRET/);
});
test("disallows unauthenticated or invalid ownership consent and unsafe hosts",()=>{
 const origins=["http://example.com","https://127.0.0.1","https://localhost","https://api.internal","https://user:pw@example.com",
  "https://example.com/private","https://example.com:8443","https://example.com?x=1",
  "https://[::1]","ftp://example.com"];
 for(const website of origins)assert.throws(()=>normalizeCustomerRequest({website,authorized:true,consentVersion:"gatehouse-diagnostic-v1"}),undefined,website);
 for(const req of [{website:"https://example.com",authorized:false,consentVersion:"gatehouse-diagnostic-v1"},
 {website:"https://example.com",authorized:true,consentVersion:"unknown"},
 {website:"https://example.com",consentVersion:"gatehouse-diagnostic-v1"}]){
  assert.throws(()=>normalizeCustomerRequest(req));
 }
});
test("site records only use an authenticated server-derived user ID, never client labels or payment assertions",()=>{
 const row=buildTenantSiteRow({
  userId,submitted:{website:"https://example.com",authorized:true,consentVersion:"gatehouse-diagnostic-v1",userId:"attacker",paid:true},
  now:"2026-10-13T15:00:00.000Z"
 });
 assert.deepEqual(row,{
  owner_user_id:userId,
  origin:"https://example.com",
  consent_version:"gatehouse-diagnostic-v1",
  authorized_at:"2026-10-13T15:00:00.000Z",
  stage:"awaiting-domain-control"
 });
 assert.throws(()=>buildTenantSiteRow({userId:"forged",submitted:{website:"https://example.com",authorized:true,consentVersion:"gatehouse-diagnostic-v1"}}));
 assert.throws(()=>buildTenantSiteRow({userId,submitted:{website:"https://example.com",authorized:true,consentVersion:"gatehouse-diagnostic-v1"},now:"invalid"}));
});
test("paid report delivery always remains on hold without provider and customer evidence",()=>{
 for(const values of [{},{paid:true,verified:true,ownerApproved:true,customerMatched:true,domainVerified:true,reportReady:true}]){
  const d=assessDelivery(values);
  assert.deepEqual(d,{status:"HOLD",customerReportReleased:false,verifiedPaidOrder:false,
  reportDeliveryEnabled:false,subscriptionBillingEnabled:false,
  notice:"Authenticated intake does not establish site ownership, purchase, report accuracy or buyer delivery."});
 }
});
test("public status and site confirmation do not expose buyer IDs, site origins, emails or report content",()=>{
 const raw={id:"abc",owner_user_id:userId,origin:"https://private.example.com",email:"buyer@example.com",
 report:{body:"sensitive"},created_at:"2026-10-13T15:00:00Z",stage:"awaiting-domain-control"};
 const out=publicAccountState(raw);
 assert.deepEqual(out,{stage:"awaiting-domain-control",domainControlVerified:false,paidOrderVerified:false,
   reportDelivered:false,purchaseEnabled:false});
 assert.doesNotMatch(JSON.stringify(out),/buyer|private|abc|sensitive/);
});
