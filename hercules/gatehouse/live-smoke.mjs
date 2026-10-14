/**
 * Independent GET-only HTTP smoke for the exact public Gatehouse preview.
 * No keys, cookies, write requests, customer data, or paid-path activation.
 * Successful checks DO NOT establish real payment, provider readback or payout.
 */
import {pathToFileURL} from "node:url";

export const GATEHOUSE_SMOKE_ORIGIN="https://hercules-gatehouse-preview.onrender.com";
const fail=step=>{throw new Error("public-smoke-failed:"+step)};
const jsonPaths=[
 ["/health",body=>body?.service==="hercules-gatehouse"
  &&body.status==="running"&&body.mode==="isolated-read-only"
  &&body.productionAuthorized===false],
 ["/api/customer/portal-readiness",body=>body?.status==="preview-only"
  &&body.checkoutEnabled===false&&body.registrationOpen===false
  &&body.customerDataCollectionEnabled===false
  &&body.reportDeliveryEnabled===false],
 ["/api/customer/auth/capability",body=>body?.customerSignupEnabled===false
  &&body.checkoutEnabled===false&&body.reportDeliveryEnabled===false]
];
const forbiddenPaths=[
 "/api/private/shopify-order-readback",
 "/api/customer/reports"
];
export async function runGatehousePublicSmoke({fetcher=fetch,timeoutMs=90000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)
  fail("timeout-configuration");
 let count=0;
 for(const [path,valid] of jsonPaths){
  let response,body;
  try{
   response=await fetcher(GATEHOUSE_SMOKE_ORIGIN+path,{
    method:"GET",redirect:"error",headers:{accept:"application/json"},
    signal:AbortSignal.timeout(timeoutMs)
   });
   if(response?.status!==200
    ||!/^application\/json(?:\s*;|$)/i.test(response.headers?.get("content-type")||""))
    fail("public-http:"+path);
   body=await response.json();
  }catch{fail("public-fetch:"+path)}
  if(!valid(body))fail("public-contract:"+path);
  count++;
 }
 for(const path of forbiddenPaths){
  let response;
  try{
   response=await fetcher(GATEHOUSE_SMOKE_ORIGIN+path,{
    method:"GET",redirect:"error",headers:{accept:"application/json"},
    signal:AbortSignal.timeout(timeoutMs)
   });
  }catch{fail("private-fetch:"+path)}
  if(response?.status!==401&&response?.status!==503)
   fail("anonymous-private-denial:"+path);
  count++;
 }
 return {
  status:"verified-readonly-http-contract",checks:count,
  checkoutEnabled:false,reportDeliveryEnabled:false,
  providerOrderReadVerified:false
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const result=await runGatehousePublicSmoke();
  process.stdout.write(JSON.stringify(result)+"\n");
 }catch(error){
  process.stderr.write((/^public-smoke-failed:/.test(error?.message||"")
   ?error.message:"public-smoke-failed:unknown")+"\n");
  process.exitCode=1;
 }
}
