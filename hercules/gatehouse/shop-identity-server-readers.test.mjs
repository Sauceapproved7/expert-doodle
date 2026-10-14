import test from "node:test";
import assert from "node:assert/strict";
import {createGatehouseServerIdentityReaders} from "./shop-identity-server-readers.mjs";
import {assessGatehouseShopIdentity} from "./shop-identity-preflight.mjs";

const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const APP="1ed12710f0b797a7a3328c1cf4e8b1f9";
const SHOP="azymhc-x0.myshopify.com";
const GID="gid://shopify/Shop/100002726208";
const PROJECT="xbwuablxhhwsaoomsoco";
const SHOP_TOKEN="SYNTHETIC_PRIVATE_SHOPIFY_TOKEN_NOT_REAL";
const DB_TOKEN="SYNTHETIC_PRIVATE_DB_SERVICE_ROLE_NOT_REAL";
const goodProvider={
 organization_id:ORG,provider:"shopify",client_id:APP,status:"active",
 metadata:{shop_domain:SHOP}
};
const goodGatehouse={
 organization_id:ORG,client_id:APP,shop_gid:GID,shop_domain:SHOP,
 status:"readback-only"
};
const goodShop={data:{shop:{id:GID,myshopifyDomain:SHOP}}};

function httpFake({shop=goodShop,provider=[goodProvider],gatehouse=[goodGatehouse],status=200}={}){
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url,options});
  const body=url.includes("/graphql.json")?shop:
   url.includes("/hercules_provider_connections?")?provider:
   url.includes("/gatehouse_shopify_readonly_connections?")?gatehouse:null;
  return new Response(JSON.stringify(body),{
   status,headers:{"content-type":"application/json"}
  });
 };
 const create=override=>createGatehouseServerIdentityReaders({
  enabled:true,fetchImpl,shopifyAdminToken:SHOP_TOKEN,
  supabaseServiceRoleKey:DB_TOKEN,...override
 });
 return {calls,create};
}

test("trusted, read-only adapters confirm exact two-store identity and expose no credentials",async()=>{
 const h=httpFake(),reader=h.create();
 assert.deepEqual(await assessGatehouseShopIdentity(reader),
  {matched:true,reason:"shop-identity-matched"});
 assert.equal(h.calls.length,3);
 assert.equal(h.calls.filter(c=>c.options.method==="POST").length,1);
 assert.equal(h.calls.filter(c=>c.options.method==="GET").length,2);
 for(const call of h.calls){
  assert.equal(call.options.redirect,"error");
  assert.equal(call.options.cache,"no-store");
  assert.ok(call.url.startsWith("https://"));
  assert.ok(!call.url.includes(SHOP_TOKEN));
  assert.ok(!call.url.includes(DB_TOKEN));
 }
 assert.match(h.calls[0].url,
  /^https:\/\/azymhc-x0\.myshopify\.com\/admin\/api\/2026-10\/graphql\.json$/);
 assert.match(h.calls[0].options.body,/myshopifyDomain/);
 assert.match(h.calls[0].options.body,/\bshop\b/);
 assert.equal(h.calls[0].options.headers["X-Shopify-Access-Token"],SHOP_TOKEN);
 for(const c of h.calls.slice(1)){
  assert.match(c.url,new RegExp("^https://"+PROJECT+"\\.supabase\\.co/rest/v1/"));
  assert.equal(c.options.headers.apikey,DB_TOKEN);
  assert.equal(c.options.headers.Authorization,"Bearer "+DB_TOKEN);
  assert.match(c.url, /organization_id=eq\./);
  assert.match(c.url, /limit=2/);
  assert.doesNotMatch(c.url,/secret_ref|access_secret_ref|decrypted_secret/);
 }
 const flattened=JSON.stringify(await reader.readProviderIdentity());
 assert.doesNotMatch(flattened,/SYNTHETIC|Bearer|secret|token/);
});

test("real observed Supabase wrong-shop identity stays HOLD even with correct Shopify shop",async()=>{
 const h=httpFake({provider:[{...goodProvider,metadata:{shop_domain:"sauceapproved-2.myshopify.com"}}]});
 assert.equal((await assessGatehouseShopIdentity(h.create())).matched,false);
});

test("missing private server permissions block before a single request",async()=>{
 const h=httpFake();
 for(const override of [
  {enabled:false},{shopifyAdminToken:""},{supabaseServiceRoleKey:""},
  {fetchImpl:null}
 ]){
  const readers=h.create(override);
  const result=await assessGatehouseShopIdentity(readers);
  assert.deepEqual(result,{matched:false,reason:"shop-identity-unverified"});
 }
 assert.equal(h.calls.length,0);
});

test("conflicting, duplicate and missing Supabase metadata block identity",async()=>{
 const fixtures=[
  {provider:[]},{gatehouse:[]},
  {provider:[goodProvider,goodProvider]},
  {gatehouse:[goodGatehouse,goodGatehouse]},
  {provider:[{...goodProvider,client_id:null}]},
  {provider:[{...goodProvider,status:"revoked"}]},
  {gatehouse:[{...goodGatehouse,status:"revoked"}]},
  {gatehouse:[{...goodGatehouse,client_id:"wrong-app"}]},
  {gatehouse:[{...goodGatehouse,shop_gid:"gid://shopify/Shop/999"}]},
  {provider:[{...goodProvider,organization_id:"0388a570-7e32-4d63-9bee-9df0c877bbf9"}]}
 ];
 for(const input of fixtures){
  const r=await assessGatehouseShopIdentity(httpFake(input).create());
  assert.equal(r.matched,false,JSON.stringify(input));
 }
});

test("GraphQL provider errors, wrong shop, oversized responses and HTTP redirects fail closed",async()=>{
 for(const input of [
  {shop:{errors:[{message:"PRIVATE_SHOPIFY_AUTH_ERROR"}]}},
  {shop:{data:{shop:{id:"gid://shopify/Shop/999",myshopifyDomain:SHOP}}}},
  {shop:{data:{shop:{id:GID,myshopifyDomain:"sauceapproved-2.myshopify.com"}}}},
  {shop:{data:{shop:{id:GID,myshopifyDomain:SHOP}},debug:"A".repeat(12000)}},
  {status:302}
 ]){
  const readers=httpFake(input).create();
  const r=await assessGatehouseShopIdentity(readers);
  assert.equal(r.matched,false);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_SHOPIFY|SYNTHETIC|Bearer/);
 }
});

test("untrusted GraphQL and database responses are not confused with unqualified approvals",async()=>{
 const h=httpFake({shop:{data:{shop:{id:GID,myshopifyDomain:SHOP}},errors:[{message:"bad auth"}]}});
 assert.equal((await assessGatehouseShopIdentity(h.create())).matched,false);
 const bogus=httpFake({provider:[{...goodProvider,metadata:{shop_domain:SHOP},client_id:APP,
  injected_shop_gid:GID}],gatehouse:[{...goodGatehouse,shop_gid:null}]});
 assert.equal((await assessGatehouseShopIdentity(bogus.create())).matched,false);
});
