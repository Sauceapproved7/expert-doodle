import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";

async function withServer(config,fn){
 const server=createServer(config);
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{await fn("http://127.0.0.1:"+server.address().port)}
 finally{await new Promise(ok=>server.close(ok))}
}
test("the commercial preview presents an offer but never a payment link or subscription action",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  const page=await fetch(base+"/commercial");
  assert.equal(page.status,200);
  assert.match(page.headers.get("content-type"),/text\/html/);
  const html=await page.text();
  assert.match(html,/Not yet available for purchase/);
  assert.doesNotMatch(html,/<form[^>]+action=/);
  assert.doesNotMatch(html,/<style>| style="/);
  assert.match(html,/<link rel="stylesheet" href="\/commercial.css">/);
  assert.equal((await fetch(base+"/commercial.css")).status,200);
  assert.doesNotMatch(html,/buy\.stripe\.com|checkout\.stripe\.com|shopify\.com\/checkout/);
  const catalog=await(await fetch(base+"/api/commercial/catalog")).json();
  assert.equal(catalog.diagnostic.purchaseEnabled,false);
  assert.equal(catalog.subscriptions.every(x=>!x.purchaseEnabled),true);
 });
});
test("read-only diagnostic sample is a downloadable honest report, not a paid delivery",async()=>{
 const probes=[{name:"Studio",url:"https://sauceapproved-studio.onrender.com/health"}];
 await withServer({accessToken:"",probeUrls:probes,fetcher:async()=>({status:200})},async base=>{
  const r=await fetch(base+"/api/commercial/demo-report");
  assert.equal(r.status,200);
  assert.match(r.headers.get("content-disposition"),/attachment;/);
  const data=await r.json();
  assert.equal(data.customerWebsiteProbed,false);
  assert.equal(data.verifiedPaidOrder,false);
  assert.equal(data.deliveryAuthorized,false);
  assert.deepEqual(data.observations.map(x=>x.name),["Studio"]);
  assert.equal(JSON.stringify(data).includes("onrender.com"),false);
 });
});
test("all payment and customer intake mutations are unavailable",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  for(const path of ["/api/commercial/catalog","/api/commercial/demo-report"]){
   assert.equal((await fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:"{}"})).status,405);
  }
  for(const path of ["/api/commercial/checkout","/api/commercial/orders","/api/commercial/subscribe","/api/commercial/deliver","/api/commercial/intake"]){
   assert.equal((await fetch(base+path,{method:"POST"})).status,404);
  }
  assert.equal((await fetch(base+"/api/dashboard")).status,503);
 });
});
