import test from "node:test";
import assert from "node:assert/strict";
import {createBrowserAdapter} from "../hercules-bot/browser-adapter.mjs";

test("browser adapter maps operator commands to server-side browser submit",async()=>{
 let request=null;
 const adapter=createBrowserAdapter({submit:async r=>{request=r;return {ok:true,requestId:9}}});
 const result=await adapter["browser-navigate"]({command:{payload:{target:"https://example.com"}}});
 assert.equal(result.requestId,9);
 assert.equal(request.action,"navigate");
 assert.equal(request.target,"https://example.com");
});

test("browser adapter never receives owner credentials from command payload",async()=>{
 const adapter=createBrowserAdapter({submit:async r=>{assert.equal("token" in r,false);return {ok:true}}});
 await adapter["browser-navigate"]({command:{payload:{target:"https://example.com",token:"bad"}}});
});
