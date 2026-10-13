import test from "node:test";
import assert from "node:assert/strict";
import {createSmallzOwnerBridge} from "../hercules-bot/owner-session-bridge.mjs";

test("Smallz forwards owner bearer only in server authorization header",async()=>{
 let seen;
 const bridge=createSmallzOwnerBridge({endpoint:"https://example.test/functions/v1/hercules-mcp-work",fetchImpl:async(url,init)=>{seen={url,init};return {ok:true,json:async()=>({ok:true})}}});
 await bridge({ownerAuthorization:"Bearer owner-session",action:"bot_browser_navigate",url:"https://example.com"});
 assert.equal(seen.init.headers.authorization,"Bearer owner-session");
 assert.equal(seen.init.body.includes("owner-session"),false);
});
test("Smallz rejects missing or malformed owner authorization",async()=>{
 const bridge=createSmallzOwnerBridge({endpoint:"https://example.test",fetchImpl:async()=>{throw new Error("should not call")}});
 await assert.rejects(()=>bridge({action:"bot_browser_scrape",url:"https://example.com"}),/owner authorization required/);
 await assert.rejects(()=>bridge({ownerAuthorization:"Basic nope",action:"bot_browser_scrape",url:"https://example.com"}),/owner authorization required/);
});
test("Smallz owner bridge only exposes bounded browser actions",async()=>{
 const bridge=createSmallzOwnerBridge({endpoint:"https://example.test",fetchImpl:async()=>({ok:true,json:async()=>({ok:true})})});
 await assert.rejects(()=>bridge({ownerAuthorization:"Bearer x",action:"bot_deploy_publish",url:"https://example.com"}),/action denied/);
});
