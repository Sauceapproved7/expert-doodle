import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";

async function withServer(config,fn){
 const server=createServer(config);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{await fn("http://127.0.0.1:"+server.address().port)}
 finally{await new Promise(resolve=>server.close(resolve))}
}
test("readiness endpoint discloses missing commercial proof and rejects any writes",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async url=>{
  const r=await fetch(url+"/api/commercial/fulfillment-readiness");
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.status,"HOLD");
  assert.equal(data.purchaseEnabled,false);
  assert.equal(data.deliveryAuthorized,false);
  assert.equal(data.actualCustomerOrdersVerified,null);
  assert.ok(data.missing.length>=5);
  assert.equal((await fetch(url+"/api/commercial/fulfillment-readiness",{method:"POST"})).status,405);
  assert.equal((await fetch(url+"/api/commercial/checkout",{method:"POST"})).status,404);
 });
});
test("printable sample report only includes observed allowed public services, cannot fulfill buyer",async()=>{
 const probes=[{name:"Studio",url:"https://sauceapproved-studio.onrender.com/health"}];
 await withServer({accessToken:"",probeUrls:probes,fetcher:async()=>({status:200})},async url=>{
  const r=await fetch(url+"/commercial/report-preview");
  assert.equal(r.status,200);
  assert.match(r.headers.get("content-type"),/text\/html/);
  const html=await r.text();
  assert.match(html,/SAMPLE REPORT — NOT A CUSTOMER SCAN/);
  assert.match(html,/Studio/);
  assert.match(html,/Reachable/);
  assert.match(html,/No verified paid customer order/);
  assert.doesNotMatch(html,/sauceapproved-studio.onrender.com/);
  assert.doesNotMatch(html,/<script\b/);
  assert.equal((await fetch(url+"/commercial/report-preview",{method:"POST"})).status,405);
 });
});
