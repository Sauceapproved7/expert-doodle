import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";
const key="sb_publishable_"+"testing_only";
const email="customer@example.com";
const origin="https://hercules-gatehouse-preview.onrender.com";
const jwt=["fake","bearer","session"].join(".");
const uuid="0388a570-7e32-4d63-9bee-9df0c877bbf9";
async function live(config,fn){
 const server=createServer(config);
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{await fn("http://127.0.0.1:"+server.address().port)}finally{await new Promise(ok=>server.close(ok))}
}
test("public auth capability stays closed until specifically enabled",async()=>{
 await live({probeUrls:[],accessToken:""},async base=>{
  const r=await fetch(base+"/api/customer/auth/capability");
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.emailCodeEnabled,false);
  assert.equal(data.customerSignupEnabled,false);
  assert.equal(data.checkoutEnabled,false);
  assert.equal(data.reportDeliveryEnabled,false);
  const attempt=await fetch(base+"/api/customer/auth/request-code",{method:"POST",headers:{"content-type":"application/json",origin,"x-gatehouse-request":"1"},body:JSON.stringify({email})});
  assert.equal(attempt.status,503);
 });
});
test("OTP request uses fixed backend Auth API; never returns the email or magic session",async()=>{
 let requests=0;
 await live({probeUrls:[],accessToken:"",customerAuthEnabled:true,customerPublishableKey:key,
  authFetcher:async()=>{requests++;return {ok:true,status:200,json:async()=>({})}}},async base=>{
  const r=await fetch(base+"/api/customer/auth/request-code",{method:"POST",headers:{"content-type":"application/json",origin,"x-gatehouse-request":"1"},body:JSON.stringify({email})});
  assert.equal(r.status,200);
  assert.equal((await r.json()).sent,"if-account-exists");
  assert.equal(requests,1);
  assert.equal(r.headers.get("set-cookie"),null);
 });
});
test("customer code verified server-side stores token only in HttpOnly same-site secure cookie",async()=>{
 const authFetcher=async(url,opts)=>{
  if(String(url).endsWith("/verify"))return {ok:true,status:200,json:async()=>({access_token:jwt,expires_in:1200})};
  return {ok:true,status:200,json:async()=>({id:uuid,is_anonymous:false})};
 };
 await live({probeUrls:[],accessToken:"",customerAuthEnabled:true,customerPublishableKey:key,authFetcher},async base=>{
  const r=await fetch(base+"/api/customer/auth/verify-code",{method:"POST",
   headers:{"content-type":"application/json",origin,"x-gatehouse-request":"1"},body:JSON.stringify({email,code:"123456"})});
  assert.equal(r.status,200);
  assert.equal((await r.json()).signedIn,true);
  const cookie=r.headers.get("set-cookie");
  assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
  assert.match(cookie,/Max-Age=1200/);
  const sess=await fetch(base+"/api/customer/auth/session",{headers:{cookie:cookie.split(";")[0]}});
  assert.equal(sess.status,200);
  assert.equal((await sess.json()).signedIn,true);
  assert.doesNotMatch(JSON.stringify(await (await fetch(base+"/api/customer/auth/capability")).json()),/token|@example/);
 });
});
test("customer sites stays independently disabled even after OTP sign-in",async()=>{
 await live({probeUrls:[],accessToken:"",customerAuthEnabled:true,customerPublishableKey:key,
  authFetcher:async()=>({ok:true,status:200,json:async()=>({id:uuid,is_anonymous:false})})},async base=>{
  const r=await fetch(base+"/api/customer/sites",{headers:{cookie:"__Host-gh_customer_session="+jwt}});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,"customer-intake-not-open");
 });
});
test("portal sign-in page discloses disabled auth without exposing cookies or adding external scripts",async()=>{
 await live({probeUrls:[],accessToken:""},async base=>{
  const r=await fetch(base+"/portal/access");
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/Enrollment is not open yet/);
  assert.match(html,/email-code-form/);
  assert.match(html,/disabled/);
  assert.match(html,/sauceapproved-original-boy-in-cup-gatehouse\.png/);
  assert.doesNotMatch(html,/supabase\.co\/auth|service_role|access_token/);
  const js=await fetch(base+"/access.mjs");assert.equal(js.status,200);
  const css=await fetch(base+"/access.css");assert.equal(css.status,200);
 });
});
