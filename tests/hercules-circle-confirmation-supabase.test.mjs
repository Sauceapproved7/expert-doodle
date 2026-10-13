import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSupabaseConfirmationStore} from '../hercules-deploy/owned-circle/confirmation-supabase-store.mjs';

const sql=readFileSync(new URL('../supabase/migrations/20261013193900_hercules_circle_private_confirmation_storage_v1.sql',import.meta.url),'utf8');
const validToken='local-testing-only-owner-admin-session-token-'+'x'.repeat(48);
const addr='person@example.net';
const digest='a'.repeat(64);
const requestLog=[];
function harness(mutator){
 const fetchImpl=async(url,options)=>{
  requestLog.push({url,method:options.method,headers:options.headers,body:options.body});
  if(mutator){const custom=mutator(new URL(url),options);if(custom)return custom;}
  const u=new URL(url);
  if(u.pathname.endsWith('hercules_cloud_founders')){
   return new Response(JSON.stringify([{email:addr,status:'unverified',consent_at:'2026-10-13T20:00:00Z'}]),{status:200});
  }
  if(u.pathname.includes('/rpc/hercules_circle_consume_confirmation')){
   return new Response(JSON.stringify({ok:true,status:'email_confirmed_no_entitlement',email:addr}),{status:200});
  }
  if(options.method==='POST')return new Response('',{status:201});
  if(options.method==='PATCH')return new Response(JSON.stringify([{email:addr}]),{status:200});
  return new Response(JSON.stringify([]),{status:200});
 };
 return createSupabaseConfirmationStore({fetchImpl,adminToken:validToken});
}
test('no public access to confirmation table, only backend service role may manage it',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.hercules_circle_confirmation_challenges/i);
 assert.match(sql,/REFERENCES public\.hercules_cloud_founders\(email\)/i);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(sql,/REVOKE ALL ON public\.hercules_circle_confirmation_challenges FROM PUBLIC, anon, authenticated/i);
 assert.match(sql,/GRANT SELECT, INSERT, UPDATE ON public\.hercules_circle_confirmation_challenges TO service_role/i);
 assert.doesNotMatch(sql,/grant .+ to anon/i);
 assert.doesNotMatch(sql,/security definer/i);
});
test('forbids untrusted project origins, absent admin token and browser exposure',()=>{
 assert.throws(()=>createSupabaseConfirmationStore({fetchImpl:async()=>{},adminToken:''}),/private_server_token_required/);
 assert.throws(()=>createSupabaseConfirmationStore({fetchImpl:async()=>{},adminToken:validToken,origin:'https://other.example'}),/database_origin_not_allowlisted/);
});
test('check existing consent before issuing mail',async()=>{
 requestLog.length=0;
 const store=harness();
 const row=await store.eligible(addr);
 assert.equal(row.status,'unverified');
 assert.equal(row.consentAt,'2026-10-13T20:00:00Z');
 assert.ok(requestLog.every(x=>x.headers.authorization===('Bearer '+validToken)));
});
test('reserve private hashed challenge without returnable plaintext token',async()=>{
 requestLog.length=0;
 const store=harness();
 assert.equal(await store.reserve({email:addr,tokenDigest:digest,issuedAt:1781373600000,expiresAt:1781460000000}),true);
 const sent=requestLog.at(-1);
 assert.equal(sent.method,'POST');
 assert.match(sent.url,/hercules_circle_confirmation_challenges/);
 assert.equal(JSON.parse(sent.body).token_digest,digest);
 assert.doesNotMatch(sent.body,/secret|confirmation_link|plaintext_token/i);
});
test('email already has a challenge -> no additional invitation sent',async()=>{
 const store=harness((u,o)=>o.method==='POST'?new Response('{"code":"23505"}',{status:409}):null);
 assert.equal(await store.reserve({email:addr,tokenDigest:digest,issuedAt:1781373600000,expiresAt:1781460000000}),false);
});
test('markSent remains reserved-only and consume uses single atomic server RPC',async()=>{
 requestLog.length=0;
 const store=harness();
 await store.markSent({email:addr,tokenDigest:digest,at:1781373600000});
 const a=requestLog.at(-1);
 assert.match(a.url,/status=eq\.reserved/);
 assert.match(a.url,/token_digest=eq\./);
 assert.equal(JSON.parse(a.body).status,'sent');
 const consumed=await store.consume({tokenDigest:digest,now:1781373601000});
 const b=requestLog.at(-1);
 assert.equal(b.method,'POST');
 assert.match(b.url,/\/rpc\/hercules_circle_consume_confirmation$/);
 assert.deepEqual(JSON.parse(b.body),{p_token_digest:digest});
 assert.deepEqual(consumed,{email:addr,confirmed:true});
});
test('already consumed tokens return null, not authorized access',async()=>{
 const store=harness((u,o)=>u.pathname.includes('/rpc/hercules_circle_consume_confirmation')?
  new Response(JSON.stringify({ok:false,status:'invalid_or_expired'}),{status:200}):null);
 assert.equal(await store.consume({tokenDigest:digest,now:1781373601000}),null);
});
test('failed database requests do not leak admin token in errors',async()=>{
 const store=harness((u,o)=>new Response('bad',{status:403}));
 await assert.rejects(()=>store.eligible(addr),/owner_database_unavailable/);
});
test('invalid identifiers rejected before any database call',async()=>{
 requestLog.length=0;
 const store=harness();
 await assert.rejects(()=>store.reserve({email:'bad',tokenDigest:digest,issuedAt:1,expiresAt:2}),/invalid_confirmation_address/);
 assert.equal(requestLog.length,0);
});
