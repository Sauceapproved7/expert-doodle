import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {createEmbeddedShopifyReadOnlyGrant,verifyEmbeddedShopifyIdToken} from "./embedded-shopify-grant.mjs";

const clientId="1ed12710f0b797a7a3328c1cf4e8b1f9";
const fixtureSigningKey="TEST_ONLY_HERCULES_APP_SECRET_1234567890";
const shop="azymhc-x0.myshopify.com";
const now=Date.parse("2026-10-13T21:00:00.000Z");
const signed=(claims={},header={})=>{
 const h=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT",...header})).toString("base64url");
 const p=Buffer.from(JSON.stringify({
  aud:clientId,iss:"https://"+shop+"/admin",dest:"https://"+shop,
  exp:Math.floor(now/1000)+55,iat:Math.floor(now/1000)-5,
  nbf:Math.floor(now/1000)-5,sub:"shopify-staff-123",
  ...claims
 })).toString("base64url");
 return h+"."+p+"."+createHmac("sha256",fixtureSigningKey).update(h+"."+p).digest("base64url");
};
const credentialResponse=(overrides={})=>({ok:true,status:200,json:async()=>({
 access_token:"shpat_"+"TEST_ONLY_ACCESS_TOKEN_0123456789",
 refresh_token:"shprt_TEST_ONLY_REFRESH_TOKEN_0123456789",
 scope:"read_orders,read_products",expires_in:3600,refresh_token_expires_in:7776000,
 ...overrides
})});
const attestResponse=(shopOverride={})=>({ok:true,status:200,json:async()=>({data:{
 shop:{id:"gid://shopify/Shop/100002726208",myshopifyDomain:shop,...shopOverride},
 orders:{pageInfo:{hasNextPage:false}}
}})});
function adapter(overrides={}){
 const calls=[],stored=[];
 const fetcher=async (url,opts)=>{
  calls.push({url,opts});
  return calls.length===1?credentialResponse():attestResponse();
 };
 const storePrivateGrant=async row=>{stored.push(row);};
 return {calls,stored,config:{
  enabled:true,ownerAuthenticated:true,clientId,clientSecret:fixtureSigningKey,
  idToken:signed(),now,fetcher,storePrivateGrant,...overrides
 }};
}
test("disabled or missing owner identity/secret/storage never calls Shopify",async()=>{
 for(const diff of [{enabled:false},{ownerAuthenticated:false},{clientSecret:""},
  {idToken:""},{storePrivateGrant:null},{clientId:"different"},{now:NaN}]){
  const h=adapter(diff);
  const r=await createEmbeddedShopifyReadOnlyGrant(h.config).run();
  assert.equal(r.status,503,JSON.stringify(diff));
  assert.equal(h.calls.length,0);
  assert.equal(h.stored.length,0);
  assert.equal(r.body.checkoutEnabled,false);
  assert.equal(r.body.deliveryAuthorized,false);
 }
});
test("valid short-lived pinned-shop App Bridge ID token is verified",()=>{
 assert.deepEqual(verifyEmbeddedShopifyIdToken({idToken:signed(),clientId,clientSecret:fixtureSigningKey,now}),
  {shopDomain:shop});
});
test("forged, stale, future, wrong shop, wrong app and wrong JWT algorithm fail before network",async()=>{
 const invalid=[
  signed({aud:"wrong-app"}),signed({dest:"https://malicious.myshopify.com"}),
  signed({iss:"https://malicious.myshopify.com/admin"}),
  signed({exp:Math.floor(now/1000)-1}),
  signed({nbf:Math.floor(now/1000)+15}),
  signed({iat:Math.floor(now/1000)+15}),
  signed({exp:Math.floor(now/1000)+86400}),
  signed({}, {alg:"none"}),signed({}, {alg:"HS512"}),
  signed().replace(/.$/,"A"),
  "malformed.token",
  "Bearer "+signed()
 ];
 for(const idToken of invalid){
  const h=adapter({idToken});
  const r=await createEmbeddedShopifyReadOnlyGrant(h.config).run();
  assert.equal(r.status,503,idToken.slice(0,20));
  assert.equal(h.calls.length,0);
  assert.equal(h.stored.length,0);
 }
});
test("valid authorized offline exchange, exact shop/order attestation, private Vault transfer only",async()=>{
 const h=adapter(),result=await createEmbeddedShopifyReadOnlyGrant(h.config).run();
 assert.equal(result.status,200);
 assert.equal(result.body.status,"private-owner-read-only-grant-stored");
 assert.equal(result.body.readOrdersVerified,true);
 assert.equal(result.body.shopGidVerified,true);
 assert.equal(result.body.checkoutEnabled,false);
 assert.equal(result.body.deliveryAuthorized,false);
 assert.equal(result.body.providerPayoutVerified,false);
 assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].url,"https://"+shop+"/admin/oauth/access_token");
 assert.equal(h.calls[0].opts.method,"POST");
 assert.equal(h.calls[0].opts.redirect,"error");
 const form=new URLSearchParams(h.calls[0].opts.body);
 assert.equal(form.get("grant_type"),"urn:ietf:params:oauth:grant-type:token-exchange");
 assert.equal(form.get("subject_token_type"),"urn:ietf:params:oauth:token-type:id_token");
 assert.equal(form.get("requested_token_type"),"urn:shopify:params:oauth:token-type:offline-access-token");
 assert.equal(form.get("expiring"),"1");
 assert.equal(form.get("subject_token"),h.config.idToken);
 assert.equal(h.calls[1].url,"https://"+shop+"/admin/api/2026-10/graphql.json");
 assert.equal(h.calls[1].opts.headers["X-Shopify-Access-Token"],h.stored[0].accessToken);
 assert.match(JSON.parse(h.calls[1].opts.body).query,/orders\(first:1\)/);
 assert.equal(h.stored.length,1);
 assert.equal(h.stored[0].refreshToken,"shprt_TEST_ONLY_REFRESH_TOKEN_0123456789");
 assert.equal(h.stored[0].shopDomain,shop);
 assert.doesNotMatch(JSON.stringify(result),/shpat_|shprt_|shopify-staff|TEST_ONLY_HERCULES_APP_SECRET/);
});
test("provider response requires read_orders, bounded expiring offline token and refresh credential",async()=>{
 for(const bad of [
  {scope:"read_products"},{expires_in:0},{expires_in:100000},
  {access_token:null},{refresh_token:null},{refresh_token:"x"},
  {refresh_token_expires_in:0}
 ]){
  const h=adapter({fetcher:async(url,opt)=>{
   h.calls.push({url,opt});return credentialResponse(bad);
  }});
  const r=await createEmbeddedShopifyReadOnlyGrant(h.config).run();
  assert.equal(r.status,503,JSON.stringify(bad));
  assert.equal(h.stored.length,0);
 }
});
test("wrong shop, order-scope GraphQL error and provider outage never store a credential",async()=>{
 for(const variant of ["wrong-shop","graphql-error","throw","http-401"]){
  const h=adapter({fetcher:async(url,opts)=>{
   h.calls.push({url,opts});
   if(h.calls.length===1)return credentialResponse();
   if(variant==="wrong-shop")return attestResponse({id:"gid://shopify/Shop/999"});
   if(variant==="graphql-error")return {ok:true,status:200,json:async()=>({errors:[{message:"PROTECTED_SENSITIVE_VALUE"}]})};
   if(variant==="http-401")return {ok:false,status:401,json:async()=>({error:"PRIVATE"})};
   throw Error("PRIVATE_TOKEN_DATA");
  }});
  const r=await createEmbeddedShopifyReadOnlyGrant(h.config).run();
  assert.equal(r.status,503,variant);
  assert.equal(h.stored.length,0);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE|shpat_|shprt_|PROTECTED_SENSITIVE_VALUE/);
 }
});
test("Vault callback failure cannot report success or leak a token",async()=>{
 const h=adapter({storePrivateGrant:async()=>{throw Error("SECRET: shpat_abcd")}});
 const r=await createEmbeddedShopifyReadOnlyGrant(h.config).run();
 assert.equal(r.status,503);
 assert.equal(r.body.checkoutEnabled,false);
 assert.equal(r.body.deliveryAuthorized,false);
 assert.doesNotMatch(JSON.stringify(r),/SECRET|shpat_/);
});
