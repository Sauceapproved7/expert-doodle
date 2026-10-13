import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";
async function live(config,fn){
 const server=createServer(config);await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{await fn("http://127.0.0.1:"+server.address().port)}finally{await new Promise(ok=>server.close(ok))}
}
const uid="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const body={website:"https://example.com",authorized:true,consentVersion:"gatehouse-diagnostic-v1"};
test("new customer routes are OFF by default; no API, signup, payment or outbound network",async()=>{
 let count=0;
 await live({accessToken:"",probeUrls:[],customerFetcher:async()=>{count++;throw Error("Unexpected")}},async base=>{
  const res=await fetch(base+"/api/customer/sites",{method:"POST",headers:{"authorization":"Bearer dummy.jwt.payload","content-type":"application/json"},body:JSON.stringify(body)});
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,"customer-intake-not-open");
  assert.equal((await fetch(base+"/api/customer/sites")).status,503);
  assert.equal(count,0);
  assert.equal((await fetch(base+"/api/commercial/checkout",{method:"POST"})).status,404);
 });
});
test("unauthenticated customers can never create or read sites",async()=>{
 let count=0;
 await live({customerEnabled:true,customerPublishableKey:"sb_publishable_test",probeUrls:[],accessToken:"",
  customerFetcher:async()=>{count++;throw Error("Unexpected")}},async base=>{
  const res=await fetch(base+"/api/customer/sites",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  assert.equal(res.status,401);assert.equal(count,0);
 });
});
test("verified JWT maps to exact owner on RLS-protected REST site insert",async()=>{
 const calls=[];
 const customerFetcher=async(url,opts)=>{
  calls.push({url:String(url),options:opts});
  if(String(url).endsWith("/auth/v1/user"))return {ok:true,status:200,json:async()=>({id:uid,is_anonymous:false})};
  return {ok:true,status:201,json:async()=>[{id:"bbbbbbbb-2222-4333-8444-aaaaaaaaaaaa",stage:"awaiting-domain-control"}]};
 };
 await live({customerEnabled:true,customerPublishableKey:"sb_publishable_test",customerFetcher,accessToken:"",probeUrls:[]},async base=>{
  const res=await fetch(base+"/api/customer/sites",{
   method:"POST",headers:{"authorization":"Bearer abc.def.ghi","content-type":"application/json"},
   body:JSON.stringify({...body,owner_user_id:"FORGED",paid:true,email:"secret@example.com"})
  });
  assert.equal(res.status,201);
  const result=await res.json();
  assert.equal(result.stage,"awaiting-domain-control");
  assert.equal(result.purchaseEnabled,false);
  assert.doesNotMatch(JSON.stringify(result),/FORGED|secret@example.com|abc\.def/);
  assert.equal(calls.length,2);
  assert.ok(calls.every(c=>c.url.startsWith("https://xbwuablxhhwsaoomsoco.supabase.co/")));
  assert.equal(calls[0].options.method,"GET");
  assert.equal(calls[1].options.method,"POST");
  assert.equal(JSON.parse(calls[1].options.body).owner_user_id,uid);
  assert.equal(JSON.parse(calls[1].options.body).origin,"https://example.com");
  assert.equal(calls[1].options.redirect,"error");
 });
});
test("rejects invalid origin before making a database write",async()=>{
 const calls=[];
 const customerFetcher=async(url,opt)=>{
  calls.push(url);
  return {ok:true,status:200,json:async()=>({id:uid,is_anonymous:false})};
 };
 await live({customerEnabled:true,customerPublishableKey:"sb_publishable_test",customerFetcher,accessToken:"",probeUrls:[]},async base=>{
  const r=await fetch(base+"/api/customer/sites",{
   method:"POST",headers:{"authorization":"Bearer abc.def.ghi","content-type":"application/json"},
   body:JSON.stringify({...body,website:"http://127.0.0.1/admin"})
  });
  assert.equal(r.status,422);
  assert.equal(calls.length,1);
 });
});
