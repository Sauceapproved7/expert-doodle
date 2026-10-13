import test from 'node:test';
import assert from 'node:assert/strict';
import {readCirclePublishableKey,probeCirclePublic} from '../scripts/probe_hercules_circle_live.mjs';

const origin='https://hercules-owned-circle-free.onrender.com';
const sb='https://xbwuablxhhwsaoomsoco.supabase.co';
const bodyFor=(url)=>{
 const path=new URL(url).pathname;
 return ({
 '/':'HERCULES FOUNDING CIRCLE private software',
 '/early.html':'EARLY TESTER INTEREST consent',
 '/owner.html':'OWNER VAULT Existing owner identity only',
 '/app.mjs':'const endpoint="hercules_cloud_join_founders"',
 '/early.mjs':'const ENDPOINT="hercules_circle_request_early"',
 '/owner.mjs':'const ACL="hercules_circle_owner_acl"',
 '/circle-access.css':'.owner-wrap { color: white }'
 })[path]??'';
};
const fakeKey='sb_publishable_'+'A'.repeat(38);
const fetchFactory=(calls,mutate)=>async (url,options={})=>{
 const uri=new URL(url),method=options.method??'GET';
 calls.push({url,method,options});
 if(mutate){const r=mutate(uri,options);if(r)return r}
 if(uri.origin===origin){
  return new Response(bodyFor(url),{
   status:200,headers:{'content-type':uri.pathname.endsWith('.mjs')?'application/javascript':uri.pathname.endsWith('.css')?'text/css':'text/html'}
  });
 }
 if(uri.origin===sb&&method==='OPTIONS'){
  return new Response(null,{status:204,headers:{
   'access-control-allow-origin':'*',
   'access-control-allow-methods':'GET,POST,OPTIONS',
   'access-control-allow-headers':'apikey,content-type'
  }});
 }
 if(uri.origin===sb&&method==='GET')
   return new Response(JSON.stringify({message:'permission denied'}),{status:403,headers:{'content-type':'application/json'}});
 if(uri.origin===sb&&method==='POST')
   return new Response(JSON.stringify({ok:false,error:'consent_required'}),{status:200,headers:{'content-type':'application/json'}});
 throw Error('unexpected simulated request');
};

test('publishable identifier parser rejects secrets and missing keys',()=>{
 assert.equal(readCirclePublishableKey("const publishableKey='"+fakeKey+"';"),fakeKey);
 assert.throws(()=>readCirclePublishableKey("const secret='sb_secret_"+"A".repeat(30)+"';"),/publishable_key_missing/);
 assert.throws(()=>readCirclePublishableKey("const publishableKey='sk_live_123';"),/publishable_key_missing/);
});

test('read-only smoke checks deployed html/scripts, CORS, negative consent and anonymous records denial',async()=>{
 const calls=[];
 const data=await probeCirclePublic({fetchImpl:fetchFactory(calls),publishableKey:fakeKey});
 assert.equal(data.allPassed,true);
 assert.equal(data.checkedPages,7);
 assert.equal(data.consentFailuresRejected,2);
 assert.equal(data.privilegedTablesDenied,2);
 assert.equal(data.corsPreflightPassed,true);
 assert.equal(data.syntheticSubmissionsCreated,0);
 for(const call of calls){
  assert.ok(call.url.startsWith(origin)||call.url.startsWith(sb));
  const textBody=String(call.options.body??'');
  assert.doesNotMatch(textBody,/p_consent":true|p_email":"[^"]+@/);
  assert.equal(call.options.credentials,'omit');
 }
 assert.equal(calls.filter(x=>x.method==='POST').length,2);
});

test('fail closed when any live endpoint is missing',async()=>{
 const calls=[];
 const fetchImpl=fetchFactory(calls,(u)=>{
  if(u.pathname==='/owner.html')return new Response('Not found',{status:404});
 });
 await assert.rejects(()=>probeCirclePublic({fetchImpl,publishableKey:fakeKey}),/live_asset_unavailable/);
});

test('CORS denial fails readiness without bypass or mutations',async()=>{
 const calls=[];
 const fetchImpl=fetchFactory(calls,(u,o)=>{
  if(o.method==='OPTIONS')return new Response(null,{status:204,headers:{
   'access-control-allow-origin':'https://evil.example'
  }});
 });
 await assert.rejects(()=>probeCirclePublic({fetchImpl,publishableKey:fakeKey}),/cors_origin_denied/);
 assert.equal(calls.some(x=>x.method==='POST'),false);
});

test('public data reads being exposed fail security gate',async()=>{
 const calls=[];
 const fetchImpl=fetchFactory(calls,(u,o)=>{
  if(u.pathname.includes('hercules_circle_early_requests')&&o.method==='GET')
   return new Response(JSON.stringify([{email:'leak@example.invalid'}]),{status:200,headers:{'content-type':'application/json'}});
 });
 await assert.rejects(()=>probeCirclePublic({fetchImpl,publishableKey:fakeKey}),/public_subscriber_read_exposed/);
});

test('granted consent on a negative-call probe is rejected by design',async()=>{
 const calls=[];
 const fetchImpl=fetchFactory(calls,(u,o)=>{
  if(u.pathname.includes('/rpc/hercules_circle_request_early')&&o.method==='POST')
    return new Response(JSON.stringify({ok:true,status:'early_interest_unverified'}),{status:200,headers:{'content-type':'application/json'}});
 });
 await assert.rejects(()=>probeCirclePublic({fetchImpl,publishableKey:fakeKey}),/consent_bypass_detected/);
});

test('fixed origins disallow custom arbitrary remote target injection',async()=>{
 await assert.rejects(()=>probeCirclePublic({fetchImpl:()=>{throw Error('should not run')},publishableKey:fakeKey,origin:'https://evil.example'}),/origin_not_allowlisted/);
 await assert.rejects(()=>probeCirclePublic({fetchImpl:()=>{throw Error('should not run')},publishableKey:fakeKey,projectBase:'https://evil.example'}),/origin_not_allowlisted/);
});
