import test from "node:test";
import assert from "node:assert/strict";
import {previewSite, portalReadiness} from "./customer-portal-model.mjs";
import {createServer} from "./server.mjs";

async function withServer(config, fn) {
 const server=createServer(config);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try { await fn("http://127.0.0.1:"+server.address().port); }
 finally { await new Promise(resolve=>server.close(resolve)); }
}
test("preview parses an HTTPS website but cannot claim verified ownership or an order",()=>{
 const r=previewSite("https://www.example.com/");
 assert.deepEqual(r,{
  origin:"https://www.example.com",
  status:"format-check-only",ownershipVerified:false,
  accountCreated:false,orderVerified:false,siteScanned:false,
  dataSubmitted:false,deliveryAuthorized:false
 });
 for(const value of ["http://example.com","https://localhost","https://127.0.0.1","https://[::1]",
  "https://somewhere.internal","https://username:pass@example.com","https://example.com/private",
  "https://example.com:8080","https://example.com?q=1", "ftp://example.com", "not a url"]) {
  assert.throws(()=>previewSite(value),undefined,value);
 }
});
test("all portal feature claims remain disabled even if caller passes ready flags",()=>{
 for(const arg of [undefined,{}, {paid:true,open:true,authConfigured:true,paymentVerified:true,deliveryVerified:true}]){
  const status=portalReadiness(arg);
  assert.equal(status.registrationOpen,false);
  assert.equal(status.checkoutEnabled,false);
  assert.equal(status.customerDataCollectionEnabled,false);
  assert.equal(status.domainScanningEnabled,false);
  assert.equal(status.reportDeliveryEnabled,false);
  assert.equal(status.subscriptionsEnabled,false);
  assert.equal(status.status,"preview-only");
  assert.equal(status.priceUSD,"49.00");
 }
});
test("branded portal loads from a separate static page without payment or email capture",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  const r=await fetch(base+"/portal");
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/Original SauceApproved logo/);
  assert.match(html,/sauceapproved-original-boy-in-cup-gatehouse\.png/);
  assert.match(html,/GATEHOUSE CUSTOMER PORTAL/);
  assert.match(html,/Enrollment is not open yet/);
  assert.match(html,/preview-site-input/);
  assert.match(html,/portal\.mjs/);
  assert.doesNotMatch(html,/<form\b|checkout\.stripe\.com|\/admin\/graphql|type="password"|type="email"/i);
  const script=await fetch(base+"/portal.mjs");
  assert.equal(script.status,200);
  assert.match(script.headers.get("content-type"),/text\/javascript/);
  const css=await fetch(base+"/portal.css");
  assert.equal(css.status,200);
  assert.match(css.headers.get("content-type"),/text\/css/);
  assert.match(r.headers.get("content-security-policy"),/script-src 'self'/);
 });
});
test("public portal state stays hold even if customer endpoint feature flags are set",async()=>{
 await withServer({accessToken:"",probeUrls:[],customerEnabled:true,customerPublishableKey:"sb_publishable_test"},async base=>{
  const r=await fetch(base+"/api/customer/portal-readiness");
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.registrationOpen,false);
  assert.equal(body.checkoutEnabled,false);
  assert.equal(body.reportDeliveryEnabled,false);
  assert.equal(body.customerDataCollectionEnabled,false);
  assert.equal((await fetch(base+"/api/customer/portal-readiness",{method:"POST"})).status,405);
 });
});
test("portal pages do not unlock intake routes",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  assert.equal((await fetch(base+"/api/customer/sites")).status,503);
  assert.equal((await fetch(base+"/api/commercial/checkout",{method:"POST"})).status,404);
  assert.equal((await fetch(base+"/api/customer/portal-readiness")).status,200);
 });
});
