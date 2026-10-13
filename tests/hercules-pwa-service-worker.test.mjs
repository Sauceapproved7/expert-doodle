import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../hercules-ai/ui/service-worker.js',import.meta.url),'utf8');
const origin='https://hercules.example';
function makeWorker(network=async()=>({ok:true,source:'network'})) {
  const handlers={};
  const matched=[];
  const cached=new Map([['/',{source:'offline-shell'}],['/manifest.webmanifest',{source:'manifest'}]]);
  const caches={
    match:async key=>{const path=typeof key==='string'?key:new URL(key.url).pathname;matched.push(path);return cached.get(path)},
    open:async()=>({addAll:async()=>{}}),
    keys:async()=>[],
    delete:async()=>true
  };
  const self={location:{origin},clients:{claim:()=>{}},skipWaiting:()=>{},addEventListener:(kind,handler)=>handlers[kind]=handler};
  runInNewContext(source,{self,caches,fetch:network,URL,Promise});
  function request(path,{method='GET',mode='cors',host=origin}={}) {
    let response;
    handlers.fetch({request:{url:new URL(path,host).href,method,mode},respondWith:promise=>response=promise});
    return {intercepted:response!==undefined,result:response,matched};
  }
  return {request};
}

test('never intercepts private API GETs or substitutes HTML for an offline API response',()=>{
  const a=makeWorker(async()=>{throw Error('offline')});
  const r=a.request('/api/owner/orders');
  assert.equal(r.intercepted,false);
  assert.deepEqual(r.matched,[]);
});
test('never intercepts POST requests',()=>{
  assert.equal(makeWorker().request('/v1/chat/completions',{method:'POST'}).intercepted,false);
});
test('does not handle cross-origin requests',()=>{
  assert.equal(makeWorker().request('/image.png',{host:'https://outside.example'}).intercepted,false);
});
test('does not turn deep-link OAuth navigation into the cached home page',()=>{
  assert.equal(makeWorker().request('/oauth/consent',{mode:'navigate'}).intercepted,false);
});
test('does not intercept signed or query-bearing homepage navigation',()=>{
  assert.equal(makeWorker().request('/?code=secret',{mode:'navigate'}).intercepted,false);
});
test('offline homepage navigation uses only cached public app shell',async()=>{
  const r=makeWorker(async()=>{throw Error('offline')}).request('/',{mode:'navigate'});
  assert.equal(r.intercepted,true);
  assert.equal((await r.result).source,'offline-shell');
});
test('offline manifest falls back to manifest, not to HTML homepage',async()=>{
  const r=makeWorker(async()=>{throw Error('offline')}).request('/manifest.webmanifest');
  assert.equal(r.intercepted,true);
  assert.equal((await r.result).source,'manifest');
  assert.deepEqual(r.matched,['/manifest.webmanifest']);
});
