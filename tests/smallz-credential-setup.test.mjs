import test from 'node:test';
import assert from 'node:assert/strict';
import {createHerculesBotApp} from '../hercules-bot/app-server.mjs';

const token='a'.repeat(64),path='/connect/spaceship?handoff_token='+token;
const page='<!doctype html><html><head><title>Hercules · Spaceship DNS</title></head><body><h1>Spaceship DNS secure setup</h1><form method="post"></form></body></html>';
const response=(body=page,status=200)=>({status,headers:new Headers({'content-type':'text/plain'}),text:async()=>body});

test('serves upstream setup HTML as HTML with form-safe restrictive headers',async()=>{
 const calls=[];const app=createHerculesBotApp({credentialFetch:async(...args)=>{calls.push(args);return response()}});
 const r=await app.handle({url:path,method:'GET'});
 assert.equal(r.status,200);assert.match(r.headers['content-type'],/^text\/html/);
 assert.match(r.headers['content-security-policy'],/form-action 'self'/);assert.doesNotMatch(r.headers['content-security-policy'],/sandbox/);
 assert.equal(calls[0][0],'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge?spaceship_credentials=1&handoff_token='+token);
 assert.equal(calls[0][1].redirect,'error');
});
test('missing or duplicate handoff tokens cannot call upstream',async()=>{
 const app=createHerculesBotApp({credentialFetch:async()=>{throw Error('must not run')}});
 for(const url of ['/connect/spaceship',path+'&handoff_token='+token])assert.equal((await app.handle({url})).status,400);
});
test('real HTTP form POST forwards only the two credential fields to the fixed backend',async()=>{
 let forwarded;const app=createHerculesBotApp({port:0,credentialFetch:async(url,opts)=>{forwarded={url,opts:{...opts}};return response()}});
 const {server,url}=await app.listen();
 try{
  const r=await fetch(url+path,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://smallz-hercules.onrender.com'},body:'api_key=test-key&api_secret=test-secret'});
  assert.equal(r.status,200);assert.equal(forwarded.opts.body,'api_key=test-key&api_secret=test-secret');
  assert.equal(forwarded.opts.headers.authorization,undefined);
  assert.equal((await r.text()).includes('test-secret'),false);
 }finally{await new Promise(r=>server.close(r))}
});
test('cross-origin and unexpected credential fields fail before upstream',async()=>{
 const app=createHerculesBotApp({credentialFetch:async()=>{throw Error('must not run')}});
 const req={url:path,method:'POST',contentType:'application/x-www-form-urlencoded',body:'api_key=test-key&api_secret=test-secret'};
 assert.equal((await app.handle({...req,origin:'https://untrusted.example'})).status,403);
 assert.equal((await app.handle({...req,body:req.body+'&target=https://untrusted.example'})).status,400);
});
test('upstream failure and credential echoes become readable local errors without leaked values',async()=>{
 for(const credentialFetch of [async()=>{throw Error('test-secret')},async()=>response(page+'test-secret')]){
  const r=await createHerculesBotApp({credentialFetch}).handle({url:path,method:'POST',contentType:'application/x-www-form-urlencoded',body:'api_key=test-key&api_secret=test-secret'});
  assert.equal(r.status,502);assert.match(r.headers['content-type'],/^text\/html/);assert.doesNotMatch(r.body,/test-secret/);
 }
});
