import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "./server.mjs";
import {customerAccessBridge} from "./customer-bridge.mjs";

const uid="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const other="1888a570-7e32-4d63-9bee-9df0c877bbf9";
const reportId="9388a570-7e32-4d63-9bee-9df0c877bbf9";
const siteId="8388a570-7e32-4d63-9bee-9df0c877bbf9";
const key="sb_publishable_"+"test_only";
const token="abc.def.ghi";
const row={id:reportId,site_id:siteId,owner_user_id:uid,delivery_state:"withheld",created_at:"2026-10-13T16:30:00Z",summary:{body:"SECRET PRIVATE FINDINGS"}};
async function withServer(config,fn){
 const s=createServer(config);await new Promise(resolve=>s.listen(0,"127.0.0.1",resolve));
 try{await fn("http://127.0.0.1:"+s.address().port)}
 finally{await new Promise(resolve=>s.close(resolve))}
}
test("private report inbox is closed independently of auth and customer-site intake",async()=>{
 let upstream=0;
 await withServer({accessToken:"",probeUrls:[],customerEnabled:true,customerAuthEnabled:true,customerPublishableKey:key,reportInboxEnabled:false,
  customerFetcher:async()=>{upstream++;throw Error("unexpected")}},async url=>{
  const r=await fetch(url+"/api/customer/reports",{headers:{authorization:"Bearer "+token}});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,"report-inbox-not-open");
  assert.equal(upstream,0);
  assert.equal((await fetch(url+"/api/customer/reports",{method:"POST"})).status,405);
 });
});
test("successful authenticated inbox returns only own withheld report metadata and no summary",async()=>{
 const calls=[];
 const bridge=customerAccessBridge({enabled:false,reportsEnabled:true,publishableKey:key,fetcher:async(url,opt)=>{
  calls.push({url:String(url),options:opt});
  return String(url).endsWith("/auth/v1/user")
   ?{ok:true,status:200,json:async()=>({id:uid,is_anonymous:false})}
   :{ok:true,status:200,json:async()=>[row]};
 }});
 const r=await bridge.handle({headers:{authorization:"Bearer "+token}},"reports");
 assert.equal(r.status,200);
 assert.deepEqual(r.body,{
  reports:[{id:reportId,siteId,deliveryState:"withheld",createdAt:"2026-10-13T16:30:00Z"}],
  count:1,reportContentVisible:false,deliveryAuthorized:false,verifiedPaidOrder:false
 });
 assert.equal(calls.length,2);
 assert.equal(calls[0].options.method,"GET");
 assert.equal(calls[1].options.method,"GET");
 assert.match(calls[1].url,/gatehouse_customer_reports\?select=id%2Csite_id%2Cowner_user_id%2Cdelivery_state%2Ccreated_at/);
 assert.ok(calls[1].url.includes("owner_user_id=eq."+uid));
 assert.ok(calls.every(c=>c.url.startsWith("https://xbwuablxhhwsaoomsoco.supabase.co/")));
 assert.ok(calls.every(c=>c.options.redirect==="error"));
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE FINDINGS|SECRET|summary|buyer@example.com|abc\.def\.ghi/);
});
test("foreign tenant data or unexpected delivery status fails closed",async()=>{
 for(const mutation of [{owner_user_id:other},{delivery_state:"delivered"},{id:"bad"}]){
  const bridge=customerAccessBridge({reportsEnabled:true,publishableKey:key,fetcher:async(url)=>
   String(url).endsWith("/auth/v1/user")
   ?{ok:true,status:200,json:async()=>({id:uid,is_anonymous:false})}
   :{ok:true,status:200,json:async()=>[{...row,...mutation}]}
  });
  const result=await bridge.handle({headers:{authorization:"Bearer "+token}},"reports");
  assert.equal(result.status,503,JSON.stringify(mutation));
  assert.deepEqual(result.body,{error:"private-report-storage-unavailable"});
 }
});
test("missing JWT, anonymous sessions, provider errors and invalid record shape do not expose metadata",async()=>{
 const invalid=[
  async()=>({ok:true,status:200,json:async()=>({id:uid,is_anonymous:true})}),
  async()=>({ok:false,status:401,json:async()=>({})}),
  async()=>{throw Error("SECRET NETWORK FAILURE")}
 ];
 for(const fetcher of invalid){
  const b=customerAccessBridge({reportsEnabled:true,publishableKey:key,fetcher});
  const out=await b.handle({headers:{authorization:"Bearer "+token}},"reports");
  assert.equal(out.status,401);assert.equal(out.body.error,"authenticated-customer-required");
 }
 const b=customerAccessBridge({reportsEnabled:true,publishableKey:key,fetcher:async(url)=>
  String(url).endsWith("/auth/v1/user")
   ?{ok:true,status:200,json:async()=>({id:uid,is_anonymous:false})}
   :{ok:true,status:200,json:async()=>({reports:[row]})});
 assert.equal((await b.handle({headers:{authorization:"Bearer "+token}},"reports")).status,503);
});
test("live report listing accepts only authenticated GET and never enables download or checkout",async()=>{
 const customerFetcher=async(url)=>{
  if(String(url).endsWith("/auth/v1/user"))return {ok:true,status:200,json:async()=>({id:uid,is_anonymous:false})};
  return {ok:true,status:200,json:async()=>[row]};
 };
 await withServer({accessToken:"",probeUrls:[],customerPublishableKey:key,reportInboxEnabled:true,customerFetcher},async base=>{
  const unauthorized=await fetch(base+"/api/customer/reports");
  assert.equal(unauthorized.status,401);
  const result=await fetch(base+"/api/customer/reports",{headers:{authorization:"Bearer "+token}});
  assert.equal(result.status,200);
  assert.equal((await result.json()).reports.length,1);
  assert.equal((await fetch(base+"/api/customer/reports/"+reportId,{method:"GET"})).status,404);
  assert.equal((await fetch(base+"/api/customer/report-download",{method:"POST"})).status,404);
  assert.equal((await fetch(base+"/api/commercial/checkout",{method:"POST"})).status,404);
 });
});
test("report inbox website is branded and clearly withheld, with no form to release content",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  const r=await fetch(base+"/portal/reports");
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/SauceApproved/);
  assert.match(html,/sauceapproved-original-boy-in-cup-gatehouse\.png/);
  assert.match(html,/REPORT VAULT/);
  assert.match(html,/Not available for customer delivery/);
  assert.doesNotMatch(html,/<form|checkout\.stripe\.com|type="password"/i);
  assert.equal((await fetch(base+"/report-vault.mjs")).status,200);
  assert.equal((await fetch(base+"/report-vault.css")).status,200);
 });
});
test("RLS exposes report metadata columns only, never report contents or writes",()=>{
 const sql=readFileSync(new URL("../../supabase/gatehouse_report_metadata_rls.sql",import.meta.url),"utf8");
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/grant select\s*\(\s*id,\s*site_id,\s*owner_user_id,\s*delivery_state,\s*created_at\s*\)/i);
 assert.match(sql,/for select to authenticated/i);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/is_anonymous/);
 assert.doesNotMatch(sql,/^\s*grant[^\n]*\(\s*summary\s*\)/im);
 assert.doesNotMatch(sql,/^\s*grant\s+(insert|update|delete)/im);
 assert.doesNotMatch(sql,/^\s*grant[^\n]*to\s+anon/im);
});
