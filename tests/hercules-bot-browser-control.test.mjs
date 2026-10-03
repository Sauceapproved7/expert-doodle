import test from "node:test";
import assert from "node:assert/strict";
import {createBrowserControl} from "../hercules-bot/browser-control.mjs";

test("browser control plans bounded navigation",async()=>{
 const calls=[];
 const browser=createBrowserControl({submit:async req=>{calls.push(req);return {requestId:17}}});
 const out=await browser.navigate("https://example.com");
 assert.equal(out.requestId,17);
 assert.equal(calls[0].action,"navigate");
 assert.equal(calls[0].target,"https://example.com");
});

test("browser control rejects non-http targets",async()=>{
 const browser=createBrowserControl({submit:async()=>({})});
 await assert.rejects(browser.navigate("file:///etc/passwd"),/http/https/);
});

test("browser control bounds interaction actions",async()=>{
 const calls=[];
 const browser=createBrowserControl({submit:async req=>{calls.push(req);return {requestId:18}}});
 await browser.interact([{action:"click",selector:"#go"}]);
 assert.equal(calls[0].action,"interact");
 assert.deepEqual(calls[0].steps,[{action:"click",selector:"#go"}]);
 await assert.rejects(browser.interact([{action:"javascript",code:"alert(1)"}]),/unsupported interaction/);
});

test("browser control never accepts credentials in requests",async()=>{
 const browser=createBrowserControl({submit:async req=>{
  assert.equal("token" in req,false);
  assert.equal("password" in req,false);
  return {requestId:19};
 }});
 await browser.navigate("https://example.com");
});
