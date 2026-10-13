/** Gatehouse passwordless customer authorization.
 * Gate-disabled by default. No Supabase signup, no browser tokens, no customer emails until approved.
 */
import {createHash} from "node:crypto";
const BASE="https://xbwuablxhhwsaoomsoco.supabase.co";
const ORIGIN="https://hercules-gatehouse-preview.onrender.com";
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const COOKIE="__Host-gh_customer_session";
const error=(status,reason)=>({status,body:{error:reason}});
const clearCookie=COOKIE+"=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
function emailValid(value){return typeof value==="string"&&value.length<=254&&EMAIL.test(value)&&!/[\r\n\x00-\x1f\x7f]/.test(value)}
function bearerToken(value){return typeof value==="string"&&value.length>=5&&value.length<=4096&&/^[A-Za-z0-9._-]+$/.test(value)}
function sessionCookie(header){
 if(typeof header!=="string"||header.length>8192)return "";
 const entry=header.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));
 const raw=entry?.slice(COOKIE.length+1)||"";
 return bearerToken(raw)?raw:"";
}
function csrf(headers){
 return headers?.origin===ORIGIN&&headers?.["x-gatehouse-request"]==="1";
}
export function createCustomerAuthenticator({enabled=false,publishableKey="",fetcher=fetch,now=Date.now}={}){
 const ready=enabled===true&&typeof publishableKey==="string"&&publishableKey.startsWith("sb_publishable_");
 const sends=new Map(),attempts=new Map();
 function withinLimit(map,kind,address,mail,windowMs,maximum){
  const current=now();
  const digest=createHash("sha256").update(kind+"|"+String(address||"none")+"|"+mail).digest("hex");
  let count=map.get(digest);
  if(!count||current-count.since>=windowMs)count={since:current,hits:0};
  count.hits+=1;map.set(digest,count);
  if(map.size>512){
   for(const [key,record] of map){if(current-record.since>=windowMs)map.delete(key)}
   while(map.size>512)map.delete(map.keys().next().value);
  }
  return count.hits<=maximum;
 }
 async function upstream(path,method,body,token){
  const headers={apikey:publishableKey,accept:"application/json"};
  if(body!==undefined)headers["content-type"]="application/json";
  if(token)headers.authorization="Bearer "+token;
  const result=await fetcher(BASE+path,{
   method,headers,redirect:"error",signal:AbortSignal.timeout(10000),
   body:body===undefined?undefined:JSON.stringify(body)
  });
  const data=await result.json().catch(()=>({}));
  return {ok:result.ok,status:result.status,data};
 }
 async function trustedUser(token){
  if(!bearerToken(token))return false;
  const user=await upstream("/auth/v1/user","GET",undefined,token);
  return user.ok&&UID.test(user.data?.id||"")&&user.data?.is_anonymous!==true;
 }
 async function handle({action,method="GET",headers={},body,remoteAddress=""}={}){
  if(action==="logout"&&method==="POST"&&csrf(headers))
   return {status:200,body:{signedIn:false},setCookie:clearCookie};
  if(!ready)return error(503,"customer-auth-not-open");
  if(action==="session"){
   if(method!=="GET")return error(405,"method-not-allowed");
   const token=sessionCookie(headers.cookie);
   if(!token)return error(401,"not-signed-in");
   try{
    if(await trustedUser(token))return {status:200,body:{signedIn:true,customerIntakeEnabled:false}};
   }catch{}
   return error(401,"not-signed-in");
  }
  if(method!=="POST")return error(405,"method-not-allowed");
  if(!csrf(headers))return error(403,"same-origin-required");
  if(action==="request-code"){
   if(!emailValid(body?.email))return error(422,"valid-email-required");
   const mail=body.email.toLowerCase();
   if(!withinLimit(sends,"send",remoteAddress,mail,60_000,1))return error(429,"request-too-frequent");
   try{
    const response=await upstream("/auth/v1/otp","POST",{email:mail,create_user:false});
    if(response.status>=500)return error(503,"email-service-unavailable");
   }catch{return error(503,"email-service-unavailable")}
   return {status:200,body:{sent:"if-account-exists",notice:"If an eligible account exists, check its email. Login is still separate from purchasing or receiving a report."}};
  }
  if(action==="verify-code"){
   if(!emailValid(body?.email)||typeof body?.code!=="string"||!/^[0-9]{6,8}$/.test(body.code))
    return error(422,"invalid-email-or-code");
   if(!withinLimit(attempts,"verify",remoteAddress,body.email.toLowerCase(),15*60_000,5))
    return error(429,"too-many-verification-attempts");
   try{
    const proof=await upstream("/auth/v1/verify","POST",
     {email:body.email.toLowerCase(),token:body.code,type:"email"});
    const access=proof.data?.access_token;
    const expiry=Number(proof.data?.expires_in);
    if(!proof.ok||!bearerToken(access)||!Number.isInteger(expiry)||expiry<30||expiry>3600)
     return error(401,"email-code-not-verified");
    if(!await trustedUser(access))return error(401,"email-code-not-verified");
    return {status:200,body:{signedIn:true,customerIntakeEnabled:false},
     setCookie:COOKIE+"="+access+"; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age="+expiry};
   }catch{return error(503,"verification-unavailable")}
  }
  return error(404,"route-not-available");
 }
 return {handle,readSession:sessionCookie};
}
