import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261013180000_hercules_circle_owner_beta_interest_v1.sql');
const owner=read('hercules-deploy/owned-circle/free-site/owner.html');
const ownerJs=read('hercules-deploy/owned-circle/free-site/owner.mjs');
const early=read('hercules-deploy/owned-circle/free-site/early.html');
const earlyJs=read('hercules-deploy/owned-circle/free-site/early.mjs');
const homepage=read('hercules-deploy/owned-circle/free-site/index.html');
const build=read('scripts/build_hercules_owned_circle_static.mjs');

test('owner access is seeded from unique already-verified membership, never public invitation',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.hercules_circle_owner_acl/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/hercules_memberships/i);
 assert.match(sql,/role\s*=\s*'owner'/i);
 assert.match(sql,/status\s*=\s*'active'/i);
 assert.match(sql,/auth\.users/i);
 assert.match(sql,/owner_count\s*<>\s*1/i);
 assert.match(sql,/grant select on public\.hercules_circle_owner_acl to authenticated/i);
 assert.match(sql,/using \(user_id\s*=\s*\(select auth\.uid\(\)\)\)/i);
 assert.match(sql,/revoke all on public\.hercules_circle_owner_acl from public,anon,authenticated/i);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete).*hercules_circle_owner_acl to authenticated/i);
});
test('private customer data grants SELECT only to already authorized owner user',()=>{
 assert.match(sql,/create policy hercules_cloud_founders_owner_select/i);
 assert.match(sql,/grant select on public\.hercules_cloud_founders to authenticated/i);
 assert.match(sql,/revoke select on public\.hercules_cloud_founders from anon/i);
 assert.match(sql,/m\.role\s*=\s*'owner'/i);
 assert.match(sql,/a\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
 assert.doesNotMatch(sql,/create policy[\s\S]+for select to anon/i);
});
test('early tester request is private and unverified until separately proven',()=>{
 assert.match(sql,/create table if not exists public\.hercules_circle_early_requests/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.hercules_circle_early_requests from public,anon,authenticated/i);
 assert.match(sql,/create policy hercules_circle_early_owner_select/i);
 assert.match(sql,/create policy hercules_circle_early_request_insert/i);
 assert.match(sql,/create or replace function private\.hercules_circle_early_guard/i);
 assert.match(sql,/security definer/i);
 assert.match(sql,/revoke all on function private\.hercules_circle_early_guard\(\)\s+from public,anon,authenticated/i);
 assert.match(sql,/security invoker/i);
 assert.match(sql,/create or replace function public\.hercules_circle_request_early/i);
 assert.match(sql,/pg_try_advisory_xact_lock/i);
 assert.match(sql,/if total >= 40/i);
 assert.match(sql,/return null;/i);
 assert.doesNotMatch(sql,/on conflict \(email\)/i);
 assert.match(sql,/grant execute on function public\.hercules_circle_request_early\(text,boolean,text,text,text\)\s+to anon,authenticated/i);
 assert.doesNotMatch(sql,/customer_entitlement|stripe|shopify|payout|checkout|public-registration-open/i);
});
test('owner page requires existing Supabase authentication and never registers new accounts',()=>{
 assert.match(owner,/OWNER VAULT/i);
 assert.match(owner,/Existing owner identity only/i);
 assert.match(owner,/name="email"/i);
 assert.match(owner,/name="password"/i);
 assert.match(owner,/owner\.mjs/i);
 assert.match(ownerJs,/auth\/v1\/token\?grant_type=password/);
 assert.match(ownerJs,/authorization:.*Bearer/i);
 assert.match(ownerJs,/rest\/v1\/hercules_cloud_founders/);
 assert.match(ownerJs,/rest\/v1\/hercules_circle_early_requests/);
 assert.match(ownerJs,/rest\/v1\/hercules_circle_owner_acl/);
 assert.doesNotMatch(ownerJs,/auth\/v1\/signup|service_role|sb_secret_|localStorage|sessionStorage|document\.cookie/i);
});
test('early interest form discloses no email confirmation and gives no beta entitlement',()=>{
 assert.match(early,/EARLY TESTER INTEREST/i);
 assert.match(early,/not a beta invitation/i);
 assert.match(early,/unverified/i);
 assert.match(early,/name="consent"[^>]*required/i);
 assert.match(early,/early\.mjs/i);
 assert.match(earlyJs,/rest\/v1\/rpc\/hercules_circle_request_early/);
 assert.match(earlyJs,/p_consent/);
 assert.doesNotMatch(earlyJs,/auth\/v1\/signup|service_role|sb_secret_|stripe|checkout|localStorage/i);
 assert.match(homepage,/href="\/early\.html"/);
 for(const name of ['owner.html','owner.mjs','early.html','early.mjs'])
  assert.ok(build.includes("'"+name+"'"),name+' omitted from artifact');
});
