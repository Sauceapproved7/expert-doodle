import test from "node:test";
import assert from "node:assert/strict";
import {buildWithheldSiteReport} from "./website-report.mjs";
import {issueDomainChallenge} from "./domain-proof.mjs";
const siteId="2b8a5368-d509-474d-9b55-d20e4e3043c9";
const userId="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const org="a1e57fa8-e6c1-4d34-9e22-61f781915df8";
const now=Date.parse("2026-10-13T16:30:00.000Z");
const secret=Buffer.alloc(32,0x71);
const site=()=>({id:siteId,owner_user_id:userId,origin:"https://sample.example.com",
 consent_version:"gatehouse-diagnostic-v1",authorized_at:"2026-10-13T16:00:00.000Z",
 stage:"awaiting-domain-control"});
const challenge=()=>issueDomainChallenge({origin:"https://sample.example.com",organizationId:org,
 secret,now:now-5000,nonce:Buffer.alloc(24,0x55)});
test("owner-scoped, consented site produces ONLY private withheld report record",async()=>{
 const c=challenge();
 const report=await buildWithheldSiteReport({
  siteRecord:site(),requesterId:userId,token:c.token,secret,organizationId:org,now,
  lookup:async()=>[{address:"8.8.8.8",family:4}],
  challengeRequest:async()=>({status:200,contentType:"text/plain",body:c.nonce}),
  headRequest:async()=>({status:200,tlsVerified:true,headers:{
   "strict-transport-security":"max-age=31536000","set-cookie":"PRIVATE-VALUE",
   "x-shopify-access-token":"PRIVATE-SECRET"
  }})
 });
 assert.equal(report.owner_user_id,userId);
 assert.equal(report.site_id,siteId);
 assert.equal(report.delivery_state,"withheld");
 assert.equal(report.summary.status,"technical-observation-only");
 assert.equal(report.summary.http_status,200);
 assert.equal(report.summary.header_presence.hsts,true);
 assert.equal(report.summary.paid_order_verified,false);
 assert.equal(report.summary.customer_report_released,false);
 assert.equal(report.summary.customer_identity_verified,false);
 assert.ok(JSON.stringify(report).length<32768);
 assert.doesNotMatch(JSON.stringify(report),/8\.8\.8\.8|PRIVATE|token|nonce|shopify-access|payout/);
});
test("cross-tenant request fails before any DNS or site requests",async()=>{
 let network=0;
 const c=challenge();
 const args={
  siteRecord:site(),requesterId:"f8573522-2ca7-4278-b912-2df2af2bd299",
  token:c.token,secret,organizationId:org,now,
  lookup:async()=>{network++;return [{address:"8.8.8.8",family:4}]},
  challengeRequest:async()=>{network++;return {status:200,body:c.nonce,contentType:"text/plain"}},
  headRequest:async()=>{network++;return {status:200,headers:{}}}
 };
 await assert.rejects(()=>buildWithheldSiteReport(args));
 assert.equal(network,0);
});
test("stale consent and unapproved site state fail before outbound requests",async()=>{
 const c=challenge();let network=0;
 for(const change of [
  {authorized_at:"2026-05-13T16:00:00.000Z"},
  {stage:"verified"},
  {consent_version:"old"},
  {origin:"https://other.example.com"},
  {owner_user_id:"invalid"}
 ]){
  const args={
   siteRecord:{...site(),...change},requesterId:userId,token:c.token,secret,organizationId:org,now,
   lookup:async()=>{network++;return [{address:"8.8.8.8",family:4}]},
   challengeRequest:async()=>{network++;return {status:200,body:c.nonce,contentType:"text/plain"}},
  };
  await assert.rejects(()=>buildWithheldSiteReport(args));
 }
 assert.equal(network,0);
});
test("failed domain-control challenge cannot create a report",async()=>{
 const c=challenge();
 await assert.rejects(()=>buildWithheldSiteReport({
  siteRecord:site(),requesterId:userId,token:c.token+"X",secret,organizationId:org,now,
  lookup:async()=>[{address:"8.8.8.8",family:4}],
  challengeRequest:async()=>({status:200,body:c.nonce,contentType:"text/plain"})
 }));
});
