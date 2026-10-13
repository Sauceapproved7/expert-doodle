import test from "node:test";
import assert from "node:assert/strict";
import {createSmallzOwnerBridge} from "../hercules-bot/owner-session-bridge.mjs";

test("Smallz refuses browser actions without owner authorization",async()=>{
 const bridge=createSmallzOwnerBridge({endpoint:"https://example.invalid/work",fetchImpl:()=>{throw new Error("must not call upstream")}});
 await assert.rejects(bridge({action:"bot_browser_navigate",url:"https://example.com"}),/owner authorization required/);
});
test("Smallz refuses browser mutations outside bounded action allowlist",async()=>{
 const bridge=createSmallzOwnerBridge({endpoint:"https://example.invalid/work",fetchImpl:()=>{throw new Error("must not call upstream")}});
 for(const action of ["bot_browser_click","bot_browser_fill","bot_browser_submit","bot_browser_execute_script"]){
  await assert.rejects(bridge({ownerAuthorization:"Bearer owner-token",action,url:"https://example.com"}),/action denied/);
 }
});
test("Smallz blocks non-HTTP URLs before contacting upstream",async()=>{
 const bridge=createSmallzOwnerBridge({endpoint:"https://example.invalid/work",fetchImpl:()=>{throw new Error("must not call upstream")}});
 await assert.rejects(bridge({ownerAuthorization:"Bearer owner-token",action:"bot_browser_navigate",url:"file:///etc/passwd"}),/target must use http\/https/);
});
test("Smallz sends bearer only in header, never request body",async()=>{
 let called=false;
 const bridge=createSmallzOwnerBridge({endpoint:"https://example.invalid/work",fetchImpl:async(_endpoint,init)=>{
  called=true;
  assert.equal(init.headers.authorization,"Bearer owner-token");
  assert.deepEqual(JSON.parse(init.body),{action:"bot_browser_scrape",url:"https://example.com/"});
  assert.equal(init.body.includes("owner-token"),false);
  return {ok:true,json:async()=>({ok:true})};
 }});
 assert.deepEqual(await bridge({ownerAuthorization:"Bearer owner-token",action:"bot_browser_scrape",url:"https://example.com"}),{ok:true});
 assert.equal(called,true);
});
