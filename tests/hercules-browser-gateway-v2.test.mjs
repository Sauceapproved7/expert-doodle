import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

async function read(path){
  return readFile(new URL("../"+path, import.meta.url),"utf8");
}

test("gateway v2 owns Chromium locally instead of depending on Browserless", async()=>{
  const server=await read("hercules-browser-gateway-v2/server.mjs");
  assert.match(server,/chromium\.launch\(/);
  assert.doesNotMatch(server,/BROWSERLESS_URL|connectOverCDP|browserless/i);
  assert.match(server,/HERCULES_GATEWAY_TOKEN/);
  assert.match(server,/\/v1\/run/);
  assert.match(server,/\/health/);
});

test("gateway v2 preserves Hercules browser safety boundaries", async()=>{
  const server=await read("hercules-browser-gateway-v2/server.mjs");
  assert.match(server,/private_target_blocked/);
  assert.match(server,/unsupported_protocol/);
  assert.match(server,/networkAllowed/);
  assert.match(server,/MAX_STEPS/);
  assert.match(server,/SESSION_TTL/);
  assert.match(server,/persistSession/);
  assert.match(server,/close_session/);
  assert.doesNotMatch(server,/captcha.*bypass|cloudflare.*bypass|anti.?bot.*bypass/i);
});

test("gateway v2 package pins its browser runtime", async()=>{
  const pkg=JSON.parse(await read("hercules-browser-gateway-v2/package.json"));
  assert.equal(pkg.private,true);
  assert.equal(pkg.type,"module");
  assert.equal(pkg.dependencies["playwright-core"],"1.63.0");
});
