import test from "node:test";
import assert from "node:assert/strict";
import {assessGatehouseShopIdentity} from "./shop-identity-preflight.mjs";

const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const SHOP="azymhc-x0.myshopify.com";
const GID="gid://shopify/Shop/100002726208";
const APP="1ed12710f0b797a7a3328c1cf4e8b1f9";
const actualShopify={id:GID,myshopifyDomain:SHOP};
const actualRegistry={organizationId:ORG,shopDomain:SHOP,shopGid:GID,clientId:APP};
const readings=(shopify=actualShopify,registry=actualRegistry)=>({
 readShopifyIdentity:async()=>shopify,
 readProviderIdentity:async()=>registry
});

test("two authoritative, canonical, consistent shop identities pass identity-only preflight",async()=>{
 const decision=await assessGatehouseShopIdentity(readings());
 assert.deepEqual(decision,{matched:true,reason:"shop-identity-matched"});
 assert.equal("credentialAuthorized" in decision,false);
 assert.equal("purchaseEnabled" in decision,false);
});

test("live-reproduced Shopify vs Supabase store-name conflict fails closed",async()=>{
 const decision=await assessGatehouseShopIdentity(readings(
  actualShopify,{...actualRegistry,shopDomain:"sauceapproved-2.myshopify.com"}
 ));
 assert.deepEqual(decision,{matched:false,reason:"shop-identity-conflict"});
});

test("matching storefront display domain does not replace immutable shop ID match",async()=>{
 for(const shopify of [
  {...actualShopify,id:"gid://shopify/Shop/999"},
  {...actualShopify,myshopifyDomain:"sauceapproved.com"},
  {...actualShopify,myshopifyDomain:"AZYMHC-X0.MYSHOPIFY.COM"},
  {...actualShopify,myshopifyDomain:"https://azymhc-x0.myshopify.com"}
 ]){
  assert.equal((await assessGatehouseShopIdentity(readings(shopify))).matched,false);
 }
});

test("missing or ambiguous Supabase registry metadata never grants authority",async()=>{
 for(const registry of [
  null,{},[],[{...actualRegistry},{...actualRegistry}],
  {...actualRegistry,organizationId:"0388a570-7e32-4d63-9bee-9df0c877bbf9"},
  {...actualRegistry,shopGid:"gid://shopify/Shop/999"},
  {...actualRegistry,clientId:null},
  {...actualRegistry,clientId:"another-app"}
 ]){
  assert.equal((await assessGatehouseShopIdentity(readings(actualShopify,registry))).matched,false);
 }
});

test("missing readers, failed reads, and malformed results deny without leaking source details",async()=>{
 const cases=[
  {},{readShopifyIdentity:async()=>actualShopify},
  {readProviderIdentity:async()=>actualRegistry},
  {readShopifyIdentity:async()=>null,readProviderIdentity:async()=>actualRegistry},
  {readShopifyIdentity:async()=>{throw Error("PROVIDER_PRIVATE_DETAILS");},readProviderIdentity:async()=>actualRegistry}
 ];
 for(const evidence of cases){
  const result=await assessGatehouseShopIdentity(evidence);
  assert.deepEqual(result,{matched:false,reason:"shop-identity-unverified"});
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|secret|token|PROVIDER/);
 }
});
