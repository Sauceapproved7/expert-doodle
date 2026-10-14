import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("./sql/offline-vault-v215.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase();
test("offline Vault migration stays separate and private, with zero customer SQL access",()=>{
 assert.match(sql,/create schema if not exists hercules_private/i);
 assert.match(sql,/create table hercules_private\.gatehouse_shopify_offline_grants/i);
 assert.match(sql,/alter table hercules_private\.gatehouse_shopify_offline_grants enable row level security/i);
 assert.match(sql,/revoke all on hercules_private\.gatehouse_shopify_offline_grants from public, anon, authenticated/i);
 assert.match(sql,/revoke all on schema hercules_private from public, anon, authenticated/i);
 assert.doesNotMatch(sql,/grant\s+(all|select|insert|update|delete)\s+on\s+(?:table\s+)?hercules_private\.gatehouse_shopify_offline_grants\s+to\s+(?:anon|authenticated)/i);
 assert.doesNotMatch(sql,/alter\s+table\s+public\.hercules_provider_connections/i);
 assert.doesNotMatch(sql,/delete\s+from\s+vault\.secrets/i);
});
test("all four private SQL RPC entrypoints restrict public access and require service_role owner membership",()=>{
 for(const name of ["bootstrap","acquire","commit","release"]){
  assert.match(sql,new RegExp("create or replace function public\\.gatehouse_offline_"+name+"\\(","i"));
  assert.match(sql,new RegExp("revoke all on function public\\.gatehouse_offline_"+name+"\\(","i"));
  assert.match(sql,new RegExp("grant execute on function public\\.gatehouse_offline_"+name+"\\(","i"));
 }
 assert.match(sql,/security definer\s+set search_path = ''/i);
 assert.match(sql,/auth\.role\(\)\s*(?:<>|!=)\s*'service_role'/i);
 assert.match(sql,/from public\.hercules_memberships/i);
 assert.match(sql,/role\s*=\s*'owner'/i);
 assert.match(sql,/status\s*=\s*'active'/i);
 assert.match(sql,/organization_id\s*=\s*p_organization_id/i);
});
test("generation CAS cannot use an unowned or expired lease and both Vault refs rotate atomically",()=>{
 assert.match(sql,/lease_nonce\s*=\s*p_lease_nonce/i);
 assert.match(sql,/lease_expires_at\s*>\s*clock_timestamp\(\)/i);
 assert.match(sql,/generation\s*=\s*p_expected_generation/i);
 assert.match(sql,/generation\s*=\s*r\.generation\s*\+\s*1/i);
 assert.match(sql,/for update/i);
 const refs=(sql.match(/vault\.create_secret\(/gi)||[]).length;
 assert.ok(refs>=4,"bootstrap and rotation each create both encrypted tokens");
 assert.match(sql,/access_secret_ref\s*=\s*v_new_access/i);
 assert.match(sql,/refresh_secret_ref\s*=\s*v_new_refresh/i);
 assert.match(sql,/pg_catalog\.gen_random_uuid\(\)/i);
 assert.doesNotMatch(sql,/create\s+policy\s+.*\s+to\s+authenticated/i);
});
test("bootstrap is one-time only, release validates nonce and no old token is immediately deleted",()=>{
 assert.match(sql,/insert into hercules_private\.gatehouse_shopify_offline_grants/i);
 assert.doesNotMatch(sql,/on conflict\s*\(.+?\)\s*do update/i);
 assert.match(sql,/release/i);
 assert.match(sql,/lease_nonce\s*=\s*null/i);
 assert.match(sql,/p_refresh_token\s*=\s*v_old_refresh/i);
});
