import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createCircleConfirmationApi} from '../hercules-deploy/owned-circle/confirmation-gateway.mjs';

const ORIGIN='https://hercules-owned-circle-free.onrender.com';
async function withApi(t,options={}){
 const calls=[];
 const engine={
  async request(email){calls.push(['request',email]);if(email==='blocked@example.net')throw Error('consent_not_recorded');return {ok:true,status:'confirmation_sent_unverified'}},
  async confirm(token){calls.push(['confirm',token]);if(token==='0'.repeat(64))throw Error('invalid_or_expired_token');return {ok:true,status:'email_confirmed_no_entitlement'}}
 };
 const handler=createCircleConfirmationApi({
  engine,readiness:{ready:options.ready??false},now:()=>1770777600000,maxRequestsPerHour:options.maxRequestsPerHour??5
 });
 const server=createServer(handler);
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 t.after(async()=>{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))});
 const url='http://127.0.0.1:'+server.address().port;
 const post=(path,body,opts={})=>fetch(url+path,{
  method:'POST',headers:{origin:ORIGIN,'content-type':'application/json',...opts.headers},
  body:typeof body==='string'?body:JSON.stringify(body)
 });
 return {url,calls,post,server};
}
test('health discloses only confirmation activation status and no private data',async t=>{
 const {url}=await withApi(t);
 const r=await fetch(url+'/health');
 assert.equal(r.status,200);
 const body=await r.json();
 assert.deepEqual(body,{ok:true,service:'hercules-owned-circle-confirmation',confirmation:'held'});
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('set-cookie'),null);
});
test('fails closed before verified sender, without triggering emails',async t=>{
 const {post,calls}=await withApi(t);
 const r=await post('/api/confirm/request',{email:'member@example.net'});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'confirmation_held');
 assert.equal(calls.length,0);
});
test('origin must be exact and preflight cannot authorize random websites',async t=>{
 const {url,post,calls}=await withApi(t,{ready:true});
 const o=await fetch(url+'/api/confirm/request',{
  method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST'}
 });
 assert.equal(o.status,204);
 assert.equal(o.headers.get('access-control-allow-origin'),ORIGIN);
 const bad=await post('/api/confirm/request',{email:'member@example.net'},{headers:{origin:'https://evil.example'}});
 assert.equal(bad.status,403);assert.equal(bad.headers.get('access-control-allow-origin'),null);
 assert.equal(calls.length,0);
});
test('normal request does not expose email, token, or grant membership',async t=>{
 const {post,calls}=await withApi(t,{ready:true});
 const r=await post('/api/confirm/request',{email:'member@example.net'});
 assert.equal(r.status,202);
 assert.deepEqual(await r.json(),{ok:true,status:'request_received'});
 assert.deepEqual(calls,[['request','member@example.net']]);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unconsented and unknown addresses do not enumerate private records',async t=>{
 const {post}=await withApi(t,{ready:true});
 const one=await post('/api/confirm/request',{email:'blocked@example.net'});
 const two=await post('/api/confirm/request',{email:'member@example.net'});
 assert.equal(one.status,202);
 assert.equal(two.status,202);
 assert.deepEqual(await one.json(),await two.json());
});
test('one-time token redemption returns only ownership confirmation',async t=>{
 const {post,calls}=await withApi(t,{ready:true});
 const token='a'.repeat(64);
 const r=await post('/api/confirm/verify',{token});
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{ok:true,status:'email_confirmed_no_entitlement'});
 assert.deepEqual(calls,[['confirm',token]]);
});
test('invalid or replayed token never produces confirmed response',async t=>{
 const {post}=await withApi(t,{ready:true});
 const r=await post('/api/confirm/verify',{token:'0'.repeat(64)});
 assert.equal(r.status,400);
 assert.deepEqual(await r.json(),{ok:false,error:'invalid_or_expired_token'});
});
test('request payload size and media type bounded',async t=>{
 const {post,calls}=await withApi(t,{ready:true});
 const x=await post('/api/confirm/request',{email:'a'.repeat(3000)});
 assert.equal(x.status,413);
 const y=await post('/api/confirm/request',{email:'member@example.net'},{headers:{'content-type':'text/plain'}});
 assert.equal(y.status,415);
 assert.equal(calls.length,0);
});
test('IP requests rate limited without trusting spoofed forwarded headers',async t=>{
 const {post,calls}=await withApi(t,{ready:true,maxRequestsPerHour:2});
 const options={headers:{'x-forwarded-for':'198.51.100.42'}};
 for(let i=0;i<2;i++)assert.equal((await post('/api/confirm/request',{email:'member@example.net'},options)).status,202);
 const denied=await post('/api/confirm/request',{email:'member@example.net'},{headers:{'x-forwarded-for':'198.51.100.99'}});
 assert.equal(denied.status,429);
 assert.equal(calls.length,2);
});
test('unknown paths or body-provided proof cannot unlock held transport',async t=>{
 const {post,url,calls}=await withApi(t);
 const injected=await post('/api/confirm/request',{email:'member@example.net',ready:true,verifiedReceipt:true});
 assert.equal(injected.status,400);
 const missing=await fetch(url+'/api/owner/customer-data');
 assert.equal(missing.status,404);
 assert.equal(calls.length,0);
});
