import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

function setup({responseOk=true}={}) {
  const handlers = {};
  const puts = [];
  const prefetches = [];
  let fetches = 0;
  const cache = {addAll: async requests=>{prefetches.push(...requests.map(r=>({url:r.url,credentials:r.credentials})))}, put: async(req)=>{puts.push(req.url)}, match: async()=>null};
  const context = {
    URL,
    Request,
    location: {origin:"https://hercules.test"},
    self: {addEventListener:(kind,callback)=>{handlers[kind]=callback},skipWaiting:async()=>{}},
    caches: {open:async()=>cache, match:async()=>null, keys:async()=>[]},
    fetch: async()=>{fetches++; return {ok:responseOk,clone(){return this}}}
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js",import.meta.url),"utf8"),context);
  return {
    puts,
    prefetches,
    async install(){const waits=[];handlers.install({waitUntil(p){waits.push(Promise.resolve(p))}});await Promise.all(waits)},
    get fetches(){return fetches},
    async dispatch(url,{method="GET",mode="cors",authorization=false,credentials="same-origin"}={}) {
      let responded=false;
      const waits=[];
      const event={
        request:{url,method,mode,credentials,headers:{has:(name)=>authorization&&name.toLowerCase()==="authorization"}},
        respondWith(p){responded=true;waits.push(Promise.resolve(p))},
        waitUntil(p){waits.push(Promise.resolve(p))}
      };
      handlers.fetch(event);
      await Promise.all(waits);
      return responded;
    }
  };
}

test("query-bearing shell assets bypass caching",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://hercules.test/app.js?token=fake"),false);
  assert.equal(s.fetches,0);
  assert.deepEqual(s.puts,[]);
});
test("explicitly credential-free shell asset is cached",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://hercules.test/app.js",{credentials:"omit"}),true);
  assert.equal(s.fetches,1);
  assert.deepEqual(s.puts,["https://hercules.test/app.js"]);
});
test("navigation and POST bypass worker cache",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://hercules.test/app.js",{mode:"navigate"}),false);
  assert.equal(await s.dispatch("https://hercules.test/app.js",{method:"POST"}),false);
  assert.equal(s.fetches,0);
});
test("off-origin and API requests bypass worker cache",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://elsewhere.test/app.js"),false);
  assert.equal(await s.dispatch("https://hercules.test/api/account"),false);
  assert.equal(s.fetches,0);
});

test("failed shell response is not cached",async()=>{
  const s=setup({responseOk:false});
  assert.equal(await s.dispatch("https://hercules.test/style.css",{credentials:"omit"}),true);
  assert.equal(s.fetches,1);
  assert.deepEqual(s.puts,[]);
});

test("authorized shell requests bypass offline cache",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://hercules.test/app.js",{authorization:true}),false);
  assert.equal(s.fetches,0);
  assert.deepEqual(s.puts,[]);
});

test("credentialed shell requests bypass offline cache",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://hercules.test/app.js",{credentials:"include"}),false);
  assert.equal(s.fetches,0);
  assert.deepEqual(s.puts,[]);
});


test("default same-origin credential mode bypasses runtime cache",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://hercules.test/app.js"),false);
  assert.equal(s.fetches,0);
  assert.deepEqual(s.puts,[]);
});


test("install caches only allowlisted, explicitly credential-free static assets",async()=>{
  const s=setup();
  await s.install();
  assert.equal(s.prefetches.length,6);
  assert.ok(s.prefetches.every(r=>r.credentials==="omit"));
  assert.ok(s.prefetches.every(r=>!r.url.includes("/api/")&&!r.url.endsWith("/")));
});
