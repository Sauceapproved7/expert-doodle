import test from "node:test";
import assert from "node:assert/strict";
import {customerAccessBridge} from "./customer-bridge.mjs";

const owner="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const foreign="8388a570-7e32-4d63-9bee-9df0c877bbf9";
const site="aa88a570-7e32-4d63-9bee-9df0c877bbf9";
const token="synthetic-user-session-token";
const publishable="sb_publishable_synthetic_only";
const record=()=>({
 id:site,owner_user_id:owner,origin:"https://customer.example.com",
 stage:"awaiting-domain-control",authorized_at:"2026-10-13T18:00:00.000Z"
});
const response=data=>({ok:true,status:200,json:async()=>data});
function harness(rows,{enabled=true}={}){
 const calls=[];
 const bridge=customerAccessBridge({enabled,publishableKey:publishable,fetcher:async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith("/auth/v1/user"))
   return response({id:owner,is_anonymous:false});
  if(url.includes("gatehouse_customer_sites"))return response(rows);
  throw Error("Unexpected upstream target");
 }});
 return {bridge,calls,req:{headers:{authorization:"Bearer "+token}}};
}
test("disabled site listing sends no request and does not disclose any sites",async()=>{
 const h=harness([record()],{enabled:false});
 const r=await h.bridge.handle(h.req,"list");
 assert.equal(r.status,503);
 assert.equal(h.calls.length,0);
 assert.doesNotMatch(JSON.stringify(r),/customer.example.com|synthetic-user-session-token/);
});
test("site listing accepts exactly tenant-owned validated private rows",async()=>{
 const h=harness([record()]);
 const r=await h.bridge.handle(h.req,"list");
 assert.equal(r.status,200);
 assert.deepEqual(r.body.sites,[{
  id:site,origin:"https://customer.example.com",stage:"awaiting-domain-control",
  authorizedAt:"2026-10-13T18:00:00.000Z"
 }]);
 assert.equal(r.body.purchaseEnabled,false);
 assert.equal(r.body.deliveryAuthorized,false);
 assert.equal(h.calls.length,2);
 const siteRead=h.calls[1];
 assert.match(siteRead.url,/select=[^&]*owner_user_id/);
 assert.match(siteRead.url,/owner_user_id=eq\./);
 assert.equal(siteRead.opts.method,"GET");
 assert.equal(siteRead.opts.headers.authorization,"Bearer "+token);
});
test("cross-customer site data fails closed without returning any site",async()=>{
 const h=harness([record(),{...record(),id:foreign,owner_user_id:foreign,origin:"https://other-customer.example"}]);
 const r=await h.bridge.handle(h.req,"list");
 assert.equal(r.status,503);
 assert.equal(r.body.error,"private-site-storage-unavailable");
 assert.equal(r.body.sites,undefined);
 assert.doesNotMatch(JSON.stringify(r),/other-customer.example|customer.example.com|synthetic-user-session-token/);
});
test("site listing rejects absent tenant key or a malformed row, rather than silently accepting it",async()=>{
 const bad=[
  {...record(),owner_user_id:undefined},
  {...record(),id:"not-a-uuid"},
  {...record(),origin:"javascript:alert(1)"},
  {...record(),origin:"http://127.0.0.1"},
  {...record(),stage:"report-released"},
  {...record(),authorized_at:"not-a-date"},
  {...record(),authorized_at:undefined},
  null
 ];
 for(const row of bad){
  const h=harness([row]);
  const r=await h.bridge.handle(h.req,"list");
  assert.equal(r.status,503,JSON.stringify(row));
  assert.equal(r.body.error,"private-site-storage-unavailable");
  assert.equal(r.body.sites,undefined);
 }
});
test("provider returning more than 25 rows fails closed without leaking customer origins",async()=>{
 const rows=Array.from({length:26},()=>record());
 const h=harness(rows);
 const r=await h.bridge.handle(h.req,"list");
 assert.equal(r.status,503);
 assert.equal(r.body.sites,undefined);
 assert.doesNotMatch(JSON.stringify(r),/customer.example.com/);
});
