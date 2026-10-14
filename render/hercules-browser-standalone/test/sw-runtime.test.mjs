import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

function setup() {
  const handlers = {};
  const puts = [];
  let fetches = 0;
  const cache = {addAll: async()=>{}, put: async(req)=>{puts.push(req.url)}, match: async()=>null};
  const context = {
    URL,
    location: {origin:"https://hercules.test"},
    self: {addEventListener:(kind,callback)=>{handlers[kind]=callback}},
    caches: {open:async()=>cache, match:async()=>null, keys:async()=>[]},
    fetch: async()=>{fetches++; return {ok:true,clone(){return this}}}
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js",import.meta.url),"utf8"),context);
  return {
    puts,
    get fetches(){return fetches},
    async dispatch(url,{method="GET",mode="cors"}={}) {
      let responded=false;
      const waits=[];
      const event={
        request:{url,method,mode},
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
test("normal shell asset is cached",async()=>{
  const s=setup();
  assert.equal(await s.dispatch("https://hercules.test/app.js"),true);
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
