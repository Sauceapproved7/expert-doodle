import test from 'node:test';
import assert from 'node:assert/strict';
import {createHerculesBotApp} from '../hercules-bot/app-server.mjs';
test('permanent access page renders without credentials, scripts or registrar dependency',async()=>{
 const app=createHerculesBotApp({boundary:{authenticateOwner:async()=>{throw Error('must not authenticate a public link page')}}});
 const r=await app.handle({method:'GET',url:'/launch'});
 assert.equal(r.status,200);assert.match(r.headers['content-type'],/^text\/html/);
 assert.match(r.body,/https:\/\/sauceapproved-2.myshopify.com\/products\/sauceapproved-premium-hoodie/);
 assert.match(r.body,/href="\/app"/);assert.match(r.body,/https:\/\/sauceapproved-studio.onrender.com/);
 assert.doesNotMatch(r.body,/<script|handoff_token|access_token|api_secret/);
 assert.match(r.headers['content-security-policy'],/default-src 'none'/);
});
