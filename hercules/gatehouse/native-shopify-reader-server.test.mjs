import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";
const ownerToken="owner-test-secret-used-in-isolated-tests";
const accessToken=["test","provider","token","which","is","not","a","real","secret"].join("-");
const shop={id:"gid://shopify/Shop/100002726208",myshopifyDomain:"sauceapproved-2.myshopify.com"};
async function withServer(config,fn){
 const s=createServer({...config,probeUrls:[],accessToken:ownerToken});
 await new Promise(resolve=>s.listen(0,"127.0.0.1",resolve));
 try{await fn("http://127.0.0.1:"+s.address().port)}
 finally{await new Promise(resolve=>s.close(resolve))}
}
async function session(base){
 const r=await fetch(base+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:ownerToken})});
 assert.equal(r.status,200);return r.headers.get("set-cookie").split(";")[0];
}
test("new native owner route denies unsupported methods and unauthenticated requests before provider network",async()=>{
 let calls=0;
 await withServer({nativeShopifyEnabled:true,nativeShopifyToken:accessToken,nativeShopifyFetcher:async()=>{calls++;throw Error("must not request")}},async base=>{
  const denied=await fetch(base+"/api/private/shopify-order-readback");
  assert.equal(denied.status,401);
  assert.equal((await denied.json()).error,"owner-session-required");
  const post=await fetch(base+"/api/private/shopify-order-readback",{method:"POST"});
  assert.equal(post.status,405);
  assert.equal(calls,0);
 });
});
test("even valid owner session cannot read provider when approval flag is off or token missing",async()=>{
 for(const config of [{nativeShopifyEnabled:false,nativeShopifyToken:accessToken},
   {nativeShopifyEnabled:true,nativeShopifyToken:""}]){
  let calls=0;
  await withServer({...config,nativeShopifyFetcher:async()=>{calls++;throw Error("blocked")}},async base=>{
   const cookie=await session(base);
   const req=await fetch(base+"/api/private/shopify-order-readback",{headers:{cookie,"x-gatehouse-request":"1"}});
   assert.equal(req.status,503);const body=await req.json();
   assert.equal(body.deliveryAuthorized,false);assert.equal(calls,0);
  });
 }
});
test("native readback requires first-party custom header even after owner login",async()=>{
 let calls=0;
 await withServer({nativeShopifyEnabled:true,nativeShopifyToken:accessToken,nativeShopifyFetcher:async()=>{calls++;throw Error("must not fetch")}},async base=>{
  const cookie=await session(base);
  const r=await fetch(base+"/api/private/shopify-order-readback",{headers:{cookie}});
  assert.equal(r.status,403);
  assert.equal(calls,0);
 });
});
test("owner-only successful readback returns sanitized empty snapshot; no buyer data or fulfillment",async()=>{
 let count=0;
 await withServer({nativeShopifyEnabled:true,nativeShopifyToken:accessToken,nativeShopifyFetcher:async()=>{
  count++;return {ok:true,status:200,json:async()=>({data:{shop,orders:{edges:[],pageInfo:{hasNextPage:false,endCursor:null}}}})};
 }},async base=>{
  const cookie=await session(base);
  const r=await fetch(base+"/api/private/shopify-order-readback",{headers:{cookie,"x-gatehouse-request":"1"}});
  assert.equal(r.status,200);const body=await r.json();
  assert.equal(body.candidateCount,0);assert.equal(body.shopAuthenticated,true);
  assert.equal(body.deliveryAuthorized,false);assert.equal(body.customerEntitlementGranted,false);
  assert.doesNotMatch(JSON.stringify(body),/test-provider-token|customer@|Order\//);
  assert.equal(count,1);
 });
});
test("browser customer auth cookie does not grant owner readback",async()=>{
 let calls=0;
 await withServer({nativeShopifyEnabled:true,nativeShopifyToken:accessToken,nativeShopifyFetcher:async()=>{calls++;throw Error("blocked")}},async base=>{
  const r=await fetch(base+"/api/private/shopify-order-readback",{headers:{"cookie":"__Host-gh_customer_session=any.jws.token","x-gatehouse-request":"1"}});
  assert.equal(r.status,401);assert.equal(calls,0);
 });
});
