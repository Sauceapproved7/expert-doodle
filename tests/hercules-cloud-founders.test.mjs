import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  normalizeFoundingInterest,
  allowedFoundingOrigin,
  foundingCapacityReached
} from '../supabase/functions/hercules-cloud-founders/core.mjs';

const root=new URL('../',import.meta.url);
const sql=readFileSync(new URL('../supabase/migrations/20261013152000_hercules_cloud_founders_private_intake_v1.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/hercules-cloud-founders/index.ts',import.meta.url),'utf8');
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
test('public caller origins explicitly bounded',()=>{
 assert.equal(allowedFoundingOrigin('https://hercules-cloud-origin-preview.onrender.com'),true);
 for(const bad of [
  null,'','https://evil.example',
  'https://hercules-cloud-origin-preview.onrender.com.evil.example',
  'http://hercules-cloud-origin-preview.onrender.com',
  'https://sauceapproved.com.evil.test'
 ])assert.equal(allowedFoundingOrigin(bad),false);
});
test('capacity and available count fail closed',()=>{
 assert.equal(foundingCapacityReached(0),false);
 assert.equal(foundingCapacityReached(199),false);
 assert.equal(foundingCapacityReached(200),true);
 assert.equal(foundingCapacityReached(300),true);
 assert.equal(foundingCapacityReached(null),true);
 assert.equal(foundingCapacityReached('12'),true);
});
test('new database stores no passwords, activates no customer or hosting entitlements and cannot be enumerated',()=>{
 assert.match(sql,/create table(?: if not exists)? public\.hercules_cloud_founders/i);
 assert.match(sql,/email text not null unique/i);
 assert.match(sql,/consent_at timestamptz not null/i);
 assert.match(sql,/status text not null default 'unverified'/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.hercules_cloud_founders from public,anon,authenticated/i);
 assert.match(sql,/grant select,insert on public\.hercules_cloud_founders to service_role/i);
 assert.doesNotMatch(sql,/create policy[\s\S]*to anon/i);
 assert.doesNotMatch(sql,/hercules_continuity_ledger|hercules_launch_approvals|stripe|shopify|payout|checkout/i);
});
test('backend authenticates publishable callers in handler, records unverified interest only and rate caps submissions',()=>{
 assert.match(edge,/withSupabase\(\{\s*auth:\s*'publishable'\s*\}/);
 assert.match(edge,/foundingCapacityReached/);
 assert.match(edge,/ctx\?\.supabaseAdmin/);
 assert.match(edge,/head:\s*true/);
 assert.match(edge,/ignoreDuplicates:\s*true/);
 assert.match(edge,/notice_version:/);
 assert.match(edge,/status:\s*'unverified'/);
 assert.doesNotMatch(edge,/createUser|auth\.signUp|subscriptions|sendEmail|checkout|stripe/i);
});
test('landing states free, no hosting included, and clear opted-in privacy',()=>{
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
test('frontend avoids service role, exposes only publishable key, and reports interest as unverified',()=>{
 assert.match(client,/sb_publishable_/);
 assert.match(client,/apikey:/);
 assert.match(client,/functions\/v1\/hercules-cloud-founders/);
 assert.doesNotMatch(client,/service_role|sb_secret_|auth\/v1\/signup|checkout/i);
 assert.match(client,/Interest recorded/);
});
