import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const server=readFileSync(new URL("../server.mjs",import.meta.url),"utf8");
const worker=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");
test("owner cookie is HTTP-only, secure and same-site strict",()=>{
  assert.match(server,/hb_owner=.*HttpOnly; Secure; SameSite=Strict/);
});
test("server denies framing and applies restrictive content security policy",()=>{
  assert.match(server,/"x-frame-options":"DENY"/);
  assert.match(server,/frame-ancestors 'none'/);
});
test("browser limits concurrent contexts to one",()=>{
  assert.match(server,/const MAX_BROWSER_CONTEXTS = 1;/);
});
test("offline worker caches only explicit static assets",()=>{
  assert.match(worker,/!SHELL\.includes\(url\.pathname\)/);
  assert.doesNotMatch(worker,/const SHELL=\[[^\]]*"\/"/);
});
test("offline worker never caches non-GET or navigation requests",()=>{
  assert.match(worker,/event\.request\.method!=="GET"/);
  assert.match(worker,/event\.request\.mode==="navigate"/);
});
test("offline worker only caches successful responses",()=>{
  assert.match(worker,/if\(r\.ok\)/);
});
