import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeFoundingInterest,foundingCapacityReached} from '../supabase/functions/hercules-cloud-founders/core.mjs';

const table=readFileSync(new URL('../supabase/migrations/20261013152000_hercules_cloud_founders_private_intake_v1.sql',import.meta.url),'utf8');
const rpc=readFileSync(new URL('../supabase/migrations/20261013155500_hercules_cloud_join_founders_rpc_v1.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../hercules-deploy/cloud/founders.html',import.meta.url),'utf8');
const client=readFileSync(new URL('../hercules-deploy/cloud/founders.mjs',import.meta.url),'utf8');
const home=readFileSync(new URL('../hercules-deploy/cloud/index.html',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/build_hercules_cloud_preview.mjs',import.meta.url),'utf8');

test('founding interest is free, opt-in, email-only and never activates Hercules account signup',()=>{
 const val=normalizeFoundingInterest({email:'  SALES+FOUNDERS@Example.com ',consent:true,interest:'self-hosted',website:''});
 assert.deepEqual(val,{email:'sales+founders@example.com',interest:'self-hosted',honeypot:false});
 assert.equal(normalizeFoundingInterest({email:'a@example.com',consent:true,website:'https://spam.example'}).honeypot,true);
 for(const bad of [
  {email:'a@example.com',consent:false},
  {email:'a@example.com'},
  {email:'bad@',consent:true},
  {email:'a@example.com\nCC:other@b.com',consent:true},
  {email:'a'.repeat(300)+'@b.com',consent:true},
  {email:'a@example.com',consent:true,interest:'billing'},
  {email:'a@example.com',consent:true,price:49}
 ])assert.throws(()=>normalizeFoundingInterest(bad),/founders_/);
});
test('public signup capacity fails closed for unsupported data',()=>{
 assert.equal(foundingCapacityReached(0),false);
 assert.equal(foundingCapacityReached(199),false);
 assert.equal(foundingCapacityReached(200),true);
 assert.equal(foundingCapacityReached(null),true);
 assert.equal(foundingCapacityReached('12'),true);
});
test('isolated table denies all direct browser list and writes',()=>{
 assert.match(table,/create table(?: if not exists)? public\.hercules_cloud_founders/i);
 assert.match(table,/email text not null unique/i);
 assert.match(table,/consent_at timestamptz not null/i);
 assert.match(table,/status text not null default 'unverified'/i);
 assert.match(table,/enable row level security/i);
 assert.match(table,/revoke all on public\.hercules_cloud_founders from public,anon,authenticated/i);
 assert.match(table,/grant select,insert on public\.hercules_cloud_founders to service_role/i);
 assert.doesNotMatch(table,/create policy[\s\S]*to anon/i);
 assert.doesNotMatch(table,/hercules_continuity_ledger|hercules_launch_approvals|stripe|payout/i);
});
test('database RPC enforces server-side consent, limits and no duplicate enumeration',()=>{
 assert.match(rpc,/create or replace function public\.hercules_cloud_join_founders\(/i);
 assert.match(rpc,/security definer/i);
 assert.match(rpc,/set search_path\s*=\s*pg_catalog,\s*public/i);
 assert.match(rpc,/p_consent is not true/i);
 assert.match(rpc,/pg_try_advisory_xact_lock/i);
 assert.match(rpc,/created_at\s*>=\s*now\(\)\s*-\s*interval '24 hours'/i);
 assert.match(rpc,/count\s*>=\s*200/i);
 assert.match(rpc,/on conflict \(email\) do nothing/i);
 assert.match(rpc,/status.*'unverified'/is);
 assert.match(rpc,/revoke all on function public\.hercules_cloud_join_founders\(text,boolean,text,text\) from public/i);
 assert.match(rpc,/grant execute on function public\.hercules_cloud_join_founders\(text,boolean,text,text\) to anon,authenticated/i);
 assert.doesNotMatch(rpc,/hercules_continuity_ledger|hercules_launch_approvals|stripe|payout|refund/i);
});
test('landing promises only free founding interest and links published privacy',()=>{
 assert.match(html,/Founding Interest/i);
 assert.match(html,/No payment required/i);
 assert.match(html,/not a Hercules account/i);
 assert.match(html,/not yet include hosted deployments/i);
 assert.match(html,/I agree to receive Hercules Cloud founding updates/i);
 assert.match(html,/name="consent"[^>]*required/i);
 assert.match(html,/privacy policy/i);
 assert.match(html,/founders\.mjs/i);
 assert.doesNotMatch(html,/type="password"|credit.card|buy.now/i);
 assert.match(home,/founders\.html/i);
 assert.match(build,/founders\.html/);
 assert.match(build,/founders\.mjs/);
});
test('public client uses only publishable key and scoped RPC, with no session or checkout',()=>{
 assert.match(client,/sb_publishable_/);
 assert.match(client,/apikey:/);
 assert.match(client,/rest\/v1\/rpc\/hercules_cloud_join_founders/);
 for(const x of ['p_email','p_consent','p_interest','p_website'])assert.ok(client.includes(x),x);
 assert.doesNotMatch(client,/service_role|sb_secret_|auth\/v1\/signup|checkout/i);
 assert.match(client,/Interest recorded/);
});
