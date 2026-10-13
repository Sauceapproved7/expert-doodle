import {test} from "node:test";
import assert from "node:assert/strict";
import {offlineFloodgateAssessment,inspectSpaceshipStatus,FLOODGATE_KEYS} from "./floodgates-readonly.mjs";
const now="2026-10-12T12:00:00.000Z";
test("no evidence never opens production",()=>{
 const r=offlineFloodgateAssessment({},now);
 assert.equal(r.ready,false);assert.equal(r.missing.length,9);
});
test("even nine claimed checks cannot authorize production",()=>{
 const evidence=Object.fromEntries(FLOODGATE_KEYS.map(key=>[key,{
  verified:true,verifiedAt:now,source:key==="owner_launch_approval"?"owner-signed-approval":"trusted-provider-check",
  domain:"sauceapproved.com",environment:"production"
 }]));
 const r=offlineFloodgateAssessment(evidence,now);
 assert.equal(r.policyReady,true);assert.equal(r.productionAuthorized,false);assert.equal(r.ready,false);
});
test("status probe is read only and never exposes credentials",async()=>{
 let request;
 const fetcher=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({status:"configured",access_token:"SECRET"})}};
 const result=await inspectSpaceshipStatus(fetcher,"https://example.supabase.co/functions/v1/hercules-private-bridge","owner-session");
 assert.equal(JSON.parse(request.options.body).action,"spaceship_mcp_status");
 assert.equal(result.status,"configured");assert.equal(JSON.stringify(result).includes("SECRET"),false);
});
test("status probe rejects non HTTPS and missing auth",async()=>{
 await assert.rejects(()=>inspectSpaceshipStatus(()=>{}, "http://example.com/functions/v1/hercules-private-bridge","x"));
 await assert.rejects(()=>inspectSpaceshipStatus(()=>{}, "https://example.com/functions/v1/hercules-private-bridge",""));
});
