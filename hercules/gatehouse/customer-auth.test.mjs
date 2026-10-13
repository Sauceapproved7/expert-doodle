import test from "node:test";
import assert from "node:assert/strict";
import {createCustomerAuthenticator} from "./customer-auth.mjs";
const key="sb_publishable_"+"testing_only";
const jwt=["sample","access","token"].join(".");
const baseHeaders={origin:"https://hercules-gatehouse-preview.onrender.com","x-gatehouse-request":"1"};
const email="customer@example.com";
function auth(config={}){return createCustomerAuthenticator({enabled:true,publishableKey:key,now:()=>1000000,...config})}
test("every customer authentication request is closed by default with zero outbound requests",async()=>{
 let calls=0;
 const a=createCustomerAuthenticator({fetcher:async()=>{calls++;throw Error("should not fetch")}});
 for(const action of ["request-code","verify-code","session"]){
  const r=await a.handle({action,body:{email,code:"123456"},headers:baseHeaders,method:action==="session"?"GET":"POST"});
  assert.equal(r.status,503);
  assert.equal(r.body.error,"customer-auth-not-open");
  assert.equal(r.setCookie,undefined);
 }
 assert.equal(calls,0);
});
test("request code is same-origin, existing-users-only, with no identity disclosure",async()=>{
 const requests=[];
 const a=auth({fetcher:async (url,opts)=>{
  requests.push({url,opts});return {ok:true,status:200,json:async()=>({})};
 }});
 const r=await a.handle({action:"request-code",method:"POST",body:{email},headers:baseHeaders,remoteAddress:"198.51.100.3"});
 assert.equal(r.status,200);
 assert.equal(r.body.sent,"if-account-exists");
 assert.ok(!JSON.stringify(r).includes(email));
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,"https://xbwuablxhhwsaoomsoco.supabase.co/auth/v1/otp");
 assert.deepEqual(JSON.parse(requests[0].opts.body),{email,create_user:false});
 assert.equal(requests[0].opts.redirect,"error");
 assert.ok(!requests[0].opts.headers.authorization);
});
test("origin, suspicious email, missing anti-CSRF header and excess requests are denied without sending OTP",async()=>{
 let calls=0;
 const a=auth({fetcher:async()=>{calls++;return {ok:true,status:200,json:async()=>({})}}});
 for(const headers of [{...baseHeaders,origin:"https://attacker.example"}, {origin:baseHeaders.origin},
  {"x-gatehouse-request":"1"},{...baseHeaders,origin:"null"}]){
  const r=await a.handle({action:"request-code",method:"POST",body:{email},headers,remoteAddress:"198.51.100.2"});
  assert.equal(r.status,403);
 }
 for(const invalid of ["bad","foo\nbar@example.com","evil@example.com?to=x","x".repeat(260)+"@example.com"]){
  const r=await a.handle({action:"request-code",method:"POST",body:{email:invalid},headers:baseHeaders,remoteAddress:"198.51.100.2"});
  assert.equal(r.status,422);
 }
 const success=await a.handle({action:"request-code",method:"POST",body:{email},headers:baseHeaders,remoteAddress:"198.51.100.2"});
 assert.equal(success.status,200);
 const rate=await a.handle({action:"request-code",method:"POST",body:{email},headers:baseHeaders,remoteAddress:"198.51.100.2"});
 assert.equal(rate.status,429);
 assert.equal(calls,1);
});
test("correct OTP requires verified Supabase session and sets only secure HttpOnly session cookie",async()=>{
 const requests=[];
 const a=auth({fetcher:async (url,opts)=>{
  requests.push({url,opts});
  if(String(url).endsWith("/verify"))return {ok:true,status:200,json:async()=>({
   access_token:jwt,expires_in:3600,token_type:"bearer",user:{id:"customer-id"}
  })};
  return {ok:true,status:200,json:async()=>({id:"0388a570-7e32-4d63-9bee-9df0c877bbf9",is_anonymous:false})};
 }});
 const r=await a.handle({action:"verify-code",method:"POST",headers:baseHeaders,body:{email,code:"123456"},remoteAddress:"198.51.100.4"});
 assert.equal(r.status,200);
 assert.equal(r.body.signedIn,true);
 assert.equal(r.body.customerIntakeEnabled,false);
 assert.ok(!JSON.stringify(r.body).includes(jwt));
 assert.match(r.setCookie,/^__Host-gh_customer_session=/);
 assert.match(r.setCookie,/HttpOnly; Secure; SameSite=Strict; Path=\//);
 assert.match(r.setCookie,/Max-Age=3600/);
 assert.equal(requests.length,2);
 assert.equal(requests[0].url,"https://xbwuablxhhwsaoomsoco.supabase.co/auth/v1/verify");
 assert.equal(requests[1].opts.headers.authorization,"Bearer "+jwt);
});
test("wrong OTP and unconfirmed identity never grant a cookie",async()=>{
 const a=auth({fetcher:async()=>({ok:false,status:403,json:async()=>({})})});
 const r=await a.handle({action:"verify-code",method:"POST",headers:baseHeaders,body:{email,code:"123456"}});
 assert.equal(r.status,401);assert.equal(r.setCookie,undefined);
 const b=auth({fetcher:async(url)=>String(url).endsWith("/verify")?
  {ok:true,status:200,json:async()=>({access_token:jwt,expires_in:3600,token_type:"bearer"})}:
  {ok:true,status:200,json:async()=>({id:"bad-id"})}});
 const fail=await b.handle({action:"verify-code",method:"POST",headers:baseHeaders,body:{email,code:"123456"}});
 assert.equal(fail.status,401);assert.equal(fail.setCookie,undefined);
});
test("session reads provider Auth using only HttpOnly cookie and cannot reveal token or email",async()=>{
 let calls=0;
 const a=auth({fetcher:async(url,opts)=>{
  calls++;assert.equal(opts.headers.authorization,"Bearer "+jwt);
  return {ok:true,status:200,json:async()=>({id:"0388a570-7e32-4d63-9bee-9df0c877bbf9",email, is_anonymous:false})};
 }});
 const req={action:"session",method:"GET",headers:{cookie:"__Host-gh_customer_session="+jwt}};
 const r=await a.handle(req);
 assert.equal(r.status,200);assert.equal(r.body.signedIn,true);
 assert.equal(r.body.customerIntakeEnabled,false);
 assert.ok(!JSON.stringify(r).includes(jwt));assert.ok(!JSON.stringify(r).includes(email));
 assert.equal(calls,1);
 const unknown=await a.handle({action:"session",method:"GET",headers:{}});
 assert.equal(unknown.status,401);
});
test("logout clears cookie with secure attributes without ever querying provider",async()=>{
 const a=auth({fetcher:async()=>{throw Error("must not fetch")}});
 const r=await a.handle({action:"logout",method:"POST",headers:baseHeaders});
 assert.equal(r.status,200);assert.equal(r.body.signedIn,false);
 assert.match(r.setCookie,/Max-Age=0/);
 assert.match(r.setCookie,/HttpOnly; Secure; SameSite=Strict/);
});
