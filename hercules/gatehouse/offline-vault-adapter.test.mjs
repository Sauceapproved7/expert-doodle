import test from "node:test";
import assert from "node:assert/strict";
import {createGatehouseOfflineVaultAdapter} from "./offline-vault-adapter.mjs";
const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const OWNER="0388a570-7e32-4d63-9bee-9df0c877bbf9";
const OTHER="8388a570-7e32-4d63-9bee-9df0c877bbf9";
const SHOP="azymhc-x0.myshopify.com";
const GID="gid://shopify/Shop/100002726208";
const LEASE="df01a570-7e32-4d63-9bee-9df0c877bbf9";
const ACCESS="shpat_"+"SYNTHETIC_ACCESS_TOKEN_0123456789";
const REFRESH="shprt_"+"SYNTHETIC_REFRESH_TOKEN_0123456789";
const TOKENS={accessToken:ACCESS,refreshToken:REFRESH,shopDomain:SHOP,
 expiresAt:"2026-10-13T21:45:00.000Z",refreshExpiresAt:"2027-01-13T21:45:00.000Z"};
function setup(opts={}){
 const calls=[],map={...opts.responses};
 const rpc=async(name,params)=>{
  calls.push({name,params});
  if(opts.throwOn===name)throw Error("PRIVATE_DATABASE_DETAIL_"+name);
  const answer=map[name];
  return {data:typeof answer==="function"?answer(params):answer??null,error:null};
 };
 const config={enabled:true,workerAuthorized:true,ownerSessionVerified:true,
  organizationId:ORG,ownerUserId:OWNER,rpc,...opts.config};
 return {calls,config};
}
test("default disabled and missing verified owner, service role, or RPC never reach database",async()=>{
 for(const config of [
  {enabled:false},{workerAuthorized:false},{ownerSessionVerified:false},
  {organizationId:"some-other-org"},{ownerUserId:"not-a-uuid"},{rpc:null}
 ]){
  const h=setup({config});const a=createGatehouseOfflineVaultAdapter(h.config);
  assert.equal(await a.acquireExclusiveGrantLease(ORG),null);
  await assert.rejects(a.storePrivateGrant(TOKENS),/private-vault-not-ready/);
  assert.equal(h.calls.length,0);
 }
});
test("private bootstrap stores only via pinned service RPC and requires proven result",async()=>{
 const h=setup({responses:{gatehouse_offline_bootstrap:{stored:true,generation:1}}});
 const a=createGatehouseOfflineVaultAdapter(h.config);
 const result=await a.storePrivateGrant(TOKENS);
 assert.deepEqual(result,{stored:true,generation:1});
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,"gatehouse_offline_bootstrap");
 const p=h.calls[0].params;
 assert.deepEqual(Object.keys(p).sort(),[
  "p_organization_id","p_owner_user_id","p_access_token","p_refresh_token",
  "p_access_expires_at","p_refresh_expires_at"].sort());
 assert.equal(p.p_organization_id,ORG);
 assert.equal(p.p_owner_user_id,OWNER);
 assert.equal(p.p_access_token,ACCESS);
 assert.equal(p.p_refresh_token,REFRESH);
 assert.doesNotMatch(JSON.stringify(result),/shpat_|shprt_|SYNTHETIC/);
});
test("bootstrap fails closed for noncanonical token, dates, shop or missing database proof",async()=>{
 for(const change of [
  {shopDomain:"other.myshopify.com"},{accessToken:"invalid"},{refreshToken:"invalid"},
  {expiresAt:"invalid"},{refreshExpiresAt:"invalid"},
  {refreshExpiresAt:"2026-10-13T20:00:00Z"}
 ]){
  const h=setup({responses:{gatehouse_offline_bootstrap:{stored:true,generation:1}}});
  const a=createGatehouseOfflineVaultAdapter(h.config);
  await assert.rejects(a.storePrivateGrant({...TOKENS,...change}),/private-vault/);
  assert.equal(h.calls.length,0);
 }
 for(const receipt of [null,{stored:false,generation:1},{stored:true,generation:2}]){
  const h=setup({responses:{gatehouse_offline_bootstrap:receipt}});
  await assert.rejects(createGatehouseOfflineVaultAdapter(h.config).storePrivateGrant(TOKENS),/private-vault/);
 }
});
test("exclusive lease maps private refresh credential and rejects forged provider row",async()=>{
 const row={leased:true,organization_id:ORG,shop_domain:SHOP,shop_gid:GID,
  lease_nonce:LEASE,generation:7,refresh_token:REFRESH,
  access_expires_at:"2026-10-13T21:00:00Z",
  refresh_expires_at:"2027-01-13T21:00:00Z"};
 const h=setup({responses:{gatehouse_offline_acquire:row,
  gatehouse_offline_commit:{stored:true,generation:8},
  gatehouse_offline_release:{released:true}}});
 const a=createGatehouseOfflineVaultAdapter(h.config);
 const lease=await a.acquireExclusiveGrantLease(ORG);
 assert.equal(lease.leased,true);
 assert.equal(lease.organizationId,ORG);
 assert.equal(lease.refreshToken,REFRESH);
 assert.equal(lease.generation,7);
 assert.equal(h.calls[0].name,"gatehouse_offline_acquire");
 assert.deepEqual(h.calls[0].params,{p_organization_id:ORG,p_owner_user_id:OWNER});
 const result=await lease.commitRotation({organizationId:ORG,expectedGeneration:7,
  accessToken:ACCESS,refreshToken:REFRESH+"2",shopDomain:SHOP,shopGid:GID,
  accessExpiresAt:"2026-10-13T21:50:00Z",refreshExpiresAt:"2027-01-13T21:50:00Z"});
 assert.deepEqual(result,{stored:true,generation:8});
 assert.equal(h.calls[1].name,"gatehouse_offline_commit");
 assert.equal(h.calls[1].params.p_lease_nonce,LEASE);
 assert.equal(h.calls[1].params.p_expected_generation,7);
 await lease.release();
 assert.equal(h.calls[2].name,"gatehouse_offline_release");
 assert.equal(h.calls[2].params.p_lease_nonce,LEASE);
 assert.doesNotMatch(JSON.stringify(result),/shpat_|shprt_/);
 for(const tampered of [
  {organization_id:OTHER},{shop_domain:"other.myshopify.com"},
  {shop_gid:"gid://shopify/Shop/999"},{lease_nonce:"bad"},{generation:-1},
  {refresh_token:"invalid"}, {leased:false}
 ]){
  const bad=setup({responses:{gatehouse_offline_acquire:{...row,...tampered}}});
  assert.equal(await createGatehouseOfflineVaultAdapter(bad.config).acquireExclusiveGrantLease(ORG),null);
  assert.equal(bad.calls.length,1);
 }
});
test("lease commit refuses stale generation, changed shop or unrotated refresh token",async()=>{
 const row={leased:true,organization_id:ORG,shop_domain:SHOP,shop_gid:GID,
  lease_nonce:LEASE,generation:7,refresh_token:REFRESH,
  access_expires_at:"2026-10-13T21:00:00Z",
  refresh_expires_at:"2027-01-13T21:00:00Z"};
 for(const change of [
  {expectedGeneration:6},{organizationId:OTHER},{shopDomain:"other.myshopify.com"},
  {refreshToken:REFRESH},{accessToken:"bogus"}
 ]){
  const h=setup({responses:{gatehouse_offline_acquire:row}});
  const lease=await createGatehouseOfflineVaultAdapter(h.config).acquireExclusiveGrantLease(ORG);
  await assert.rejects(lease.commitRotation({organizationId:ORG,expectedGeneration:7,
   accessToken:ACCESS,refreshToken:REFRESH+"NEW",shopDomain:SHOP,shopGid:GID,
   accessExpiresAt:"2026-10-13T21:50:00Z",refreshExpiresAt:"2027-01-13T21:50:00Z",
   ...change}),/private-vault/);
  assert.equal(h.calls.length,1);
 }
});
test("atomic CAS conflict and RPC errors do not become authorization or token output",async()=>{
 const row={leased:true,organization_id:ORG,shop_domain:SHOP,shop_gid:GID,
  lease_nonce:LEASE,generation:7,refresh_token:REFRESH,
  access_expires_at:"2026-10-13T21:00:00Z",
  refresh_expires_at:"2027-01-13T21:00:00Z"};
 for(const value of [null,{stored:false,generation:7},{stored:true,generation:7}]){
  const h=setup({responses:{gatehouse_offline_acquire:row,gatehouse_offline_commit:value}});
  const lease=await createGatehouseOfflineVaultAdapter(h.config).acquireExclusiveGrantLease(ORG);
  const result=await lease.commitRotation({organizationId:ORG,expectedGeneration:7,
   accessToken:ACCESS,refreshToken:REFRESH+"NEW",shopDomain:SHOP,shopGid:GID,
   accessExpiresAt:"2026-10-13T21:50:00Z",refreshExpiresAt:"2027-01-13T21:50:00Z"});
  assert.deepEqual(result,{stored:false,generation:7});
 }
 const h=setup({responses:{gatehouse_offline_acquire:row},throwOn:"gatehouse_offline_commit"});
 const lease=await createGatehouseOfflineVaultAdapter(h.config).acquireExclusiveGrantLease(ORG);
 await assert.rejects(lease.commitRotation({organizationId:ORG,expectedGeneration:7,
  accessToken:ACCESS,refreshToken:REFRESH+"NEW",shopDomain:SHOP,shopGid:GID,
  accessExpiresAt:"2026-10-13T21:50:00Z",refreshExpiresAt:"2027-01-13T21:50:00Z"}),/private-vault/);
});
test("lease release is once-only and uses nonce; all failures are sanitized",async()=>{
 const row={leased:true,organization_id:ORG,shop_domain:SHOP,shop_gid:GID,
  lease_nonce:LEASE,generation:7,refresh_token:REFRESH,
  access_expires_at:"2026-10-13T21:00:00Z",
  refresh_expires_at:"2027-01-13T21:00:00Z"};
 const h=setup({responses:{gatehouse_offline_acquire:row,gatehouse_offline_release:{released:true}}});
 const lease=await createGatehouseOfflineVaultAdapter(h.config).acquireExclusiveGrantLease(ORG);
 await lease.release();
 await lease.release();
 assert.equal(h.calls.filter(x=>x.name==="gatehouse_offline_release").length,1);
 const h2=setup({responses:{gatehouse_offline_acquire:row},throwOn:"gatehouse_offline_release"});
 const badLease=await createGatehouseOfflineVaultAdapter(h2.config).acquireExclusiveGrantLease(ORG);
 await assert.rejects(badLease.release(),/private-vault/);
});
