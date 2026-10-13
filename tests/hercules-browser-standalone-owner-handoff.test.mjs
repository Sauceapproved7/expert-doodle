import test from 'node:test';
import assert from 'node:assert/strict';

const target='https://admin.shopify.com/store/azymhc-x0/settings/legal';
let importSequence=0;

async function openClient(t,{hash='',pageUrl='about:blank',savedTarget='',navigationFails=false}={}){
  const nodes=new Map(),requests=[],stored=new Map();
  if(savedTarget)stored.set('hercules.browser.start',savedTarget);
  const element=id=>{
    if(!nodes.has(id))nodes.set(id,{id,value:'',hidden:false,type:'password',classList:{add(){},remove(){}},addEventListener(){}});
    return nodes.get(id);
  };
  const location={hash,pathname:'/',search:''};
  const globals={
    location,
    history:{replaceState(){location.hash='';}},
    window:{addEventListener(){}},
    document:{hidden:false,getElementById:element,querySelectorAll(){return [];}},
    navigator:{},
    sessionStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},
    fetch:async(path,options={})=>{
      requests.push({path,options});
      if(path==='/api/claim')return Response.json({ok:true});
      if(path==='/api/status')return Response.json({authenticated:true,sessionId:'owner-session',page:{url:pageUrl,title:pageUrl==='about:blank'?'':'Existing page'},autopilot:{}});
      if(path==='/api/navigate'){
        if(navigationFails)return Response.json({error:'navigation_unavailable'},{status:502});
        pageUrl=JSON.parse(options.body).url;
        return Response.json({ok:true,sessionId:'owner-session',page:{url:pageUrl,title:'Shopify'}});
      }
      throw Error('Unexpected request: '+path);
    }
  };
  const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  await import(new URL('../render/hercules-browser-standalone/public/app.js?handoff-test='+ ++importSequence,import.meta.url));
  return {requests,nodes,stored,location};
}

test('owner handoff opens its requested task in the authenticated phone session',async t=>{
  const result=await openClient(t,{hash:'#access=fixture-token&start='+encodeURIComponent(target)});
  const navigations=result.requests.filter(r=>r.path==='/api/navigate');
  assert.equal(navigations.length,1,'a connected blank session must open the task');
  assert.deepEqual(JSON.parse(navigations[0].options.body),{url:target});
  assert.equal(result.nodes.get('pageUrl').textContent,target);
  assert.equal(result.location.hash,'','the owner token must leave the address bar');
});

test('a fresh browser context restores the saved task without consuming another owner token',async t=>{
  const result=await openClient(t,{savedTarget:target});
  assert.equal(result.requests.some(r=>r.path==='/api/claim'),false);
  assert.equal(result.requests.filter(r=>r.path==='/api/navigate').length,1);
  assert.equal(result.nodes.get('pageUrl').textContent,target);
});

test('handoff does not replace a page the owner has already opened',async t=>{
  const existing='https://accounts.shopify.com/session-service/login';
  const result=await openClient(t,{hash:'#access=fixture-token&start='+encodeURIComponent(target),pageUrl:existing});
  assert.equal(result.requests.some(r=>r.path==='/api/navigate'),false);
  assert.equal(result.nodes.get('pageUrl').textContent,existing);
});

test('credential-bearing and non-web handoff targets are never navigated or saved',async t=>{
  const result=await openClient(t,{hash:'#access=fixture-token&start='+encodeURIComponent('https://user:password@example.com/')});
  assert.equal(result.requests.some(r=>r.path==='/api/navigate'),false);
  assert.equal(result.stored.has('hercules.browser.start'),false);
});

test('failed task navigation remains visible instead of presenting an empty live screen',async t=>{
  const result=await openClient(t,{hash:'#access=fixture-token&start='+encodeURIComponent(target),navigationFails:true});
  assert.match(result.nodes.get('status')?.textContent||'',/navigation_unavailable/);
  assert.equal(result.nodes.get('screenMessage').hidden,false);
  assert.match(result.nodes.get('screenMessage').textContent,/could not open/i);
});
