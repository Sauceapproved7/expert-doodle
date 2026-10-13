import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSupabaseConfirmationStore} from '../hercules-deploy/owned-circle/confirmation-supabase-store.mjs';

const sql=readFileSync(new URL('../supabase/migrations/20261013201500_hercules_circle_atomic_verify_v1.sql',import.meta.url),'utf8');
const privateToken='server-admin-only-test-token-'+ 'x'.repeat(60);
const digest='a'.repeat(64);
const address='owned@example.net';

test('atomic verification upgrades the founder AND single-use challenge together',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.hercules_circle_consume_confirmation/i);
 assert.match(sql,/SECURITY INVOKER/i);
 assert.match(sql,/FOR UPDATE OF c,f/i);
 assert.match(sql,/f\.status='unverified'/i);
 assert.match(sql,/c\.status='sent'/i);
 assert.match(sql,/c\.expires_at\s*>\s*now\(\)/i);
 assert.match(sql,/UPDATE public\.hercules_cloud_founders/i);
 assert.match(sql,/SET status='confirmed'/i);
 assert.match(sql,/UPDATE public\.hercules_circle_confirmation_challenges/i);
 assert.match(sql,/SET status='confirmed', confirmed_at=/i);
 assert.match(sql,/RETURN jsonb_build_object\('ok',true,'status','email_confirmed_no_entitlement','email',/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.hercules_circle_consume_confirmation\(text\)/i);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.hercules_circle_consume_confirmation\(text\)\s+TO service_role/i);
 assert.doesNotMatch(sql,/security definer/i);
 assert.doesNotMatch(sql,/grant execute[^\n]*to anon/i);
});
function simulatedFetch(body,seen){
 return async(url,options)=>{
  seen.push({url,method:options.method,headers:options.headers,body:options.body});
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 };
}
test('adapter POSTs digest through protected service-only RPC, never patching challenge alone',async()=>{
 const seen=[];
 const store=createSupabaseConfirmationStore({
  adminToken:privateToken,fetchImpl:simulatedFetch({ok:true,status:'email_confirmed_no_entitlement',email:address},seen)
 });
 const result=await store.consume({tokenDigest:digest,now:1781373600000});
 assert.deepEqual(result,{email:address,confirmed:true});
 assert.equal(seen.length,1);
 assert.equal(seen[0].method,'POST');
 assert.match(seen[0].url,/\/rest\/v1\/rpc\/hercules_circle_consume_confirmation$/);
 assert.deepEqual(JSON.parse(seen[0].body),{p_token_digest:digest});
 assert.ok(!seen[0].url.includes(address));
 assert.equal(seen[0].headers.authorization,'Bearer '+privateToken);
});
test('unverified or replayed token cannot be accepted',async()=>{
 const seen=[];
 const store=createSupabaseConfirmationStore({
  adminToken:privateToken,fetchImpl:simulatedFetch({ok:false,status:'invalid_or_expired'},seen)
 });
 assert.equal(await store.consume({tokenDigest:digest,now:1781373600000}),null);
 assert.equal(seen.length,1);
});
test('malformed server confirmation receipt must fail closed',async()=>{
 const store=createSupabaseConfirmationStore({
  adminToken:privateToken,fetchImpl:simulatedFetch({ok:true,status:'confirmed',email:address},[])
 });
 await assert.rejects(()=>store.consume({tokenDigest:digest,now:1781373600000}),/owner_database_unavailable/);
});
test('reject invalid digest before requesting private service API',async()=>{
 const seen=[];
 const store=createSupabaseConfirmationStore({
  adminToken:privateToken,fetchImpl:simulatedFetch({ok:true},seen)
 });
 await assert.rejects(()=>store.consume({tokenDigest:'ab',now:1781373600000}),/invalid_confirmation_digest/);
 assert.equal(seen.length,0);
});

test('public verification page cannot send token or claim success before sender activation',()=>{
 const html=readFileSync(new URL('../hercules-deploy/owned-circle/free-site/verify.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../hercules-deploy/owned-circle/free-site/verify.mjs',import.meta.url),'utf8');
 const build=readFileSync(new URL('../scripts/build_hercules_owned_circle_static.mjs',import.meta.url),'utf8');
 assert.match(html,/Email confirmation is not active yet/i);
 assert.match(html,/No email address has been verified/i);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/verify\.mjs/);
 assert.match(js,/history\.replaceState/);
 assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|document\.cookie|sendBeacon|postMessage|service_role/i);
 assert.ok(build.includes("'verify.html'"));
 assert.ok(build.includes("'verify.mjs'"));
});
