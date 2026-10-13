import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";

async function withServer(config,fn){
 const server=createServer(config);await new Promise(r=>server.listen(0,"127.0.0.1",r));
 try{await fn("http://127.0.0.1:"+server.address().port)}
 finally{await new Promise(r=>server.close(r))}
}
test("payment-to-buyer readiness is public, but no reference is minted and no order is exposed",async()=>{
 await withServer({probeUrls:[],accessToken:""},async base=>{
  const r=await fetch(base+"/api/commercial/purchase-link-readiness");
  assert.equal(r.status,200);
  const a=await r.json();
  assert.equal(a.status,"HOLD");
  assert.equal(a.nativeShopifyReaderConnected,false);
  assert.equal(a.checkoutCorrelationConnected,false);
  assert.equal(a.orderToBuyerLinkVerified,false);
  assert.equal(a.deliveryAuthorized,false);
  assert.equal(a.purchaseEnabled,false);
  assert.equal(a.customerIntentIssuanceEnabled,false);
  assert.doesNotMatch(JSON.stringify(a),/customer@example|Order\/[0-9]+|GH1-/);
  assert.equal((await fetch(base+"/api/commercial/purchase-link-readiness",{method:"POST"})).status,405);
  assert.equal((await fetch(base+"/api/customer/purchase-intents",{method:"POST"})).status,404);
  assert.equal((await fetch(base+"/api/customer/claim-order",{method:"POST"})).status,404);
  assert.equal((await fetch(base+"/api/customer/deliver-report",{method:"POST"})).status,404);
 });
});
