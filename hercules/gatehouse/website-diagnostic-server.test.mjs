import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";
async function withServer(config,fn){
 const server=createServer(config);
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{await fn("http://127.0.0.1:"+server.address().port)}
 finally{await new Promise(ok=>server.close(ok))}
}
test("illustrative diagnostic is explicitly not a customer scan or a paid service",async()=>{
 await withServer({probeUrls:[],accessToken:""},async base=>{
  const r=await fetch(base+"/commercial/website-diagnostic-preview");
  assert.equal(r.status,200);
  assert.match(r.headers.get("content-type"),/text\/html/);
  const body=await r.text();
  assert.match(body,/ILLUSTRATIVE WEBSITE DIAGNOSTIC/);
  assert.match(body,/Not a paid deliverable/);
  assert.match(body,/Not a customer website scan/);
  assert.match(r.headers.get("content-security-policy"),/default-src 'none'/);
  assert.doesNotMatch(body,/<script|<form|<iframe/);
  assert.equal((await fetch(base+"/commercial/website-diagnostic-preview",{method:"POST"})).status,405);
  assert.equal((await fetch(base+"/api/commercial/run-diagnostic",{method:"POST"})).status,404);
 });
});
test("existing public sites and commercial state remain closed",async()=>{
 await withServer({probeUrls:[],accessToken:""},async base=>{
  const r=await fetch(base+"/api/commercial/fulfillment-readiness");
  const state=await r.json();
  assert.equal(state.status,"HOLD");
  assert.equal(state.purchaseEnabled,false);
  assert.equal(state.deliveryAuthorized,false);
  assert.equal((await fetch(base+"/api/customer/sites")).status,503);
 });
});
