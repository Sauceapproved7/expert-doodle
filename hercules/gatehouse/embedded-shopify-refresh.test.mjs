import test from "node:test";
import assert from "node:assert/strict";
import {createEmbeddedShopifyOfflineRefresh} from "./embedded-shopify-refresh.mjs";

const clientId="1ed12710f0b797a7a3328c1cf4e8b1f9";
const signingKey="SYNTHETIC_SHOPIFY_APP_KEY_FOR_TESTS_ONLY";
const ownerOrg="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const wrongOrg="fa5fb196-67f9-42fa-b592-49eeb3b84346";
const shop="azymhc-x0.myshopify.com";
const shopGid="gid://shopify/Shop/100002726208";
const at=Date.parse("2026-10-13T21:00:00.000Z");
const refreshValue="shprt_"+"SYNTHETIC_PREVIOUS_REFRESH_0123456789";
const accessValue="shpat_"+"SYNTHETIC_ACCESS_TOKEN_0123456789";
const nextRefresh="shprt_"+"SYNTHETIC_NEXT_REFRESH_0123456789";
const providerResponse=(bad={})=>({
 ok:true,status:200,json:async()=>({
  access_token:accessValue,refresh_token:nextRefresh,
  scope:"read_orders,read_products",expires_in:3600,
  refresh_token_expires_in:7776000,...bad
 })
});
const providerAttestation=(other={})=>({
 ok:true,status:200,json:async()=>({data:{
  shop:{id:shopGid,myshopifyDomain:shop,...other},
  orders:{pageInfo:{hasNextPage:false}}
 }})
});
function harness(options={}){
 const calls=[],commits=[],released=[];
 const lease={
  leased:true,organizationId:ownerOrg,generation:7,
  shopDomain:shop,shopGid,refreshToken:refreshValue,
  accessExpiresAt:new Date(at+20_000).toISOString(),
  refreshExpiresAt:new Date(at+7776000_000).toISOString(),
  commitRotation:async value=>{commits.push(value);return {stored:true,generation:8};},
  release:async()=>{released.push(true);},
  ...options.lease
 };
 const acquireExclusiveGrantLease=async o=>{
  assert.equal(o,ownerOrg);
  return lease;
 };
 const fetcher=async(url,init)=>{
  calls.push({url,init});
  return calls.length===1?providerResponse():providerAttestation();
 };
 return {calls,commits,released,lease,config:{
  enabled:true,workerAuthorized:true,organizationId:ownerOrg,
  clientId,clientSecret:signingKey,now:at,
  acquireExclusiveGrantLease,fetcher,...options
 }};
}
test("refresh is default-off; never fetches or loads Vault without worker authority and private lease",async()=>{
 for(const changes of [
  {enabled:false},{workerAuthorized:false},{organizationId:wrongOrg},
  {clientId:"wrong-app"},{clientSecret:""},{acquireExclusiveGrantLease:null},
  {now:NaN}
 ]){
  const h=harness(changes);
  const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
  assert.equal(reply.status,503);
  assert.equal(reply.body.checkoutEnabled,false);
  assert.equal(reply.body.deliveryAuthorized,false);
  assert.equal(h.calls.length,0);
  assert.equal(h.commits.length,0);
  assert.equal(h.released.length,0);
 }
});
test("not-yet-due access token does not contact Shopify or rotate credentials",async()=>{
 const h=harness({lease:{accessExpiresAt:new Date(at+15*60_000).toISOString()}});
 const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
 assert.equal(reply.status,200);
 assert.equal(reply.body.status,"refresh-not-due");
 assert.equal(reply.body.purchaseEnabled,false);
 assert.equal(h.calls.length,0);
 assert.equal(h.commits.length,0);
 assert.equal(h.released.length,1);
});
test("expiring access token obtains rotated pair, attests pinned shop and order permission, commits CAS once",async()=>{
 const h=harness();
 const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
 assert.equal(reply.status,200);
 assert.equal(reply.body.status,"refreshed-in-private-vault");
 assert.equal(reply.body.purchaseEnabled,false);
 assert.equal(reply.body.deliveryAuthorized,false);
 assert.equal(reply.body.payoutVerified,false);
 assert.equal(reply.body.customerEntitlementGranted,false);
 assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].url,"https://"+shop+"/admin/oauth/access_token");
 assert.equal(h.calls[0].init.method,"POST");
 assert.equal(h.calls[0].init.redirect,"error");
 const form=new URLSearchParams(h.calls[0].init.body);
 assert.deepEqual([...form.keys()].sort(),["client_id","client_secret","grant_type","refresh_token"].sort());
 assert.equal(form.get("grant_type"),"refresh_token");
 assert.equal(form.get("refresh_token"),refreshValue);
 assert.equal(form.get("client_id"),clientId);
 assert.equal(form.get("client_secret"),signingKey);
 assert.equal(h.calls[1].url,"https://"+shop+"/admin/api/2026-10/graphql.json");
 assert.equal(h.calls[1].init.method,"POST");
 assert.match(JSON.parse(h.calls[1].init.body).query,/orders\(first:1\)/);
 assert.equal(h.commits.length,1);
 assert.equal(h.commits[0].expectedGeneration,7);
 assert.equal(h.commits[0].accessToken,accessValue);
 assert.equal(h.commits[0].refreshToken,nextRefresh);
 assert.equal(h.commits[0].organizationId,ownerOrg);
 assert.equal(h.released.length,1);
 assert.doesNotMatch(JSON.stringify(reply),/SYNTHETIC|shpat_|shprt_|clientSecret|accessToken|refreshToken/);
});
test("malformed, cross-tenant, counterfeit or expired private lease never reaches provider",async()=>{
 const cases=[
  {organizationId:wrongOrg},{shopDomain:"sauceapproved-2.myshopify.com"},
  {shopGid:"gid://shopify/Shop/999"},{generation:-1},
  {refreshToken:"invalid"},
  {refreshExpiresAt:new Date(at-1).toISOString()},
  {accessExpiresAt:"invalid-date"},{commitRotation:null},{release:null},
  {leased:false}
 ];
 for(const bad of cases){
  const h=harness({lease:bad});
  const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
  assert.equal(reply.status,503,JSON.stringify(bad));
  assert.equal(h.calls.length,0);
  assert.equal(h.commits.length,0);
 }
});
test("provider 401 requires owner reauthorization; transient errors request later retry, never repeat now",async()=>{
 for(const code of [401,429,503,403]){
  const h=harness({fetcher:async(url,init)=>{
   h.calls.push({url,init});return {ok:false,status:code,json:async()=>({error:"SENSITIVE"})};
  }});
  const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
  assert.equal(reply.status,503);
  assert.equal(reply.body.status,code===401?"reauthorization-required":
   code===429||code===503?"retry-later":"HOLD");
  assert.equal(h.calls.length,1);
  assert.equal(h.commits.length,0);
  assert.equal(h.released.length,1);
  assert.doesNotMatch(JSON.stringify(reply),/SENSITIVE/);
 }
 const h=harness({fetcher:async()=>{throw Error("PROVIDER_PRIVATE_ERROR")}});
 const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
 assert.equal(reply.body.status,"retry-later");
 assert.equal(h.released.length,1);
 assert.doesNotMatch(JSON.stringify(reply),/PROVIDER_PRIVATE_ERROR/);
});
test("invalid scope, malformed token pair and reused refresh credential all prevent commit",async()=>{
 const cases=[
  {scope:"read_products"},{access_token:"invalid"},{refresh_token:"invalid"},
  {refresh_token:refreshValue},{expires_in:0},{expires_in:100000},
  {refresh_token_expires_in:0},{refresh_token_expires_in:3600}
 ];
 for(const bad of cases){
  const h=harness({fetcher:async(url,init)=>{h.calls.push({url,init});return providerResponse(bad)}});
  const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
  assert.equal(reply.status,503,JSON.stringify(bad));
  assert.equal(h.calls.length,1);
  assert.equal(h.commits.length,0);
  assert.equal(h.released.length,1);
 }
});
test("GraphQL scope errors or wrong shop cannot commit newly refreshed credentials",async()=>{
 for(const kind of ["wrong-id","wrong-domain","graphql-error","unavailable"]){
  const h=harness({fetcher:async(url,init)=>{
   h.calls.push({url,init});
   if(h.calls.length===1)return providerResponse();
   if(kind==="wrong-id")return providerAttestation({id:"gid://shopify/Shop/999"});
   if(kind==="wrong-domain")return providerAttestation({myshopifyDomain:"sauceapproved-2.myshopify.com"});
   if(kind==="graphql-error")return {ok:true,status:200,json:async()=>({errors:[{message:"PRIVATE_SHOPIFY_MESSAGE"}]})};
   return {ok:false,status:503,json:async()=>({})};
  }});
  const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
  assert.equal(reply.status,503,kind);
  assert.equal(h.commits.length,0);
  assert.equal(h.released.length,1);
  assert.doesNotMatch(JSON.stringify(reply),/PRIVATE_SHOPIFY_MESSAGE/);
 }
});
test("missing, false, stale or exceptional atomic-CAS receipt must never report success",async()=>{
 for(const receipt of [undefined,false,{stored:true,generation:7},{stored:false,generation:8}]){
  const h=harness({lease:{commitRotation:async value=>{h.commits.push(value);return receipt;}}});
  const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
  assert.equal(reply.status,503);
  assert.equal(reply.body.status,"HOLD");
  assert.equal(h.commits.length,1);
  assert.equal(h.released.length,1);
 }
 const h=harness({lease:{commitRotation:async()=>{throw Error("PRIVATE_VAULT_ERROR")}}});
 const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
 assert.equal(reply.status,503);
 assert.equal(h.released.length,1);
 assert.doesNotMatch(JSON.stringify(reply),/PRIVATE_VAULT_ERROR/);
});
test("lease contention fails closed and never sends a provider request",async()=>{
 const h=harness({acquireExclusiveGrantLease:async()=>null});
 const reply=await createEmbeddedShopifyOfflineRefresh(h.config).run();
 assert.equal(reply.status,503);
 assert.equal(reply.body.status,"HOLD");
 assert.equal(h.calls.length,0);
 assert.equal(h.commits.length,0);
});
