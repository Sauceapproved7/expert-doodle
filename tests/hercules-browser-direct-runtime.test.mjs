import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=await readFile(
  new URL("../render/hercules-browser-direct/server.mjs",import.meta.url),
  "utf8"
);

test("direct browser runtime launches owned Chromium instead of Browserless CDP",()=>{
  assert.match(source,/chromium\.launch\(/);
  assert.doesNotMatch(source,/connectOverCDP/);
  assert.doesNotMatch(source,/BROWSERLESS_/);
  assert.match(source,/engine:"playwright-direct-chromium"/);
});

test("direct runtime preserves bounded actions and authentication",()=>{
  assert.match(source,/HERCULES_DIRECT_TOKEN/);
  assert.match(source,/Bearer /);
  assert.match(source,/navigate/);
  assert.match(source,/scrape/);
  assert.match(source,/screenshot/);
  assert.match(source,/interact/);
  assert.match(source,/close_session/);
  assert.match(source,/rawCodeExecution:false/);
  assert.doesNotMatch(source,/new Function/);
  assert.doesNotMatch(source,/\beval\s*\(/);
});

test("direct runtime blocks private targets and keeps provider verification intact",()=>{
  assert.match(source,/private_target_blocked/);
  assert.match(source,/networkAllowed/);
  assert.match(source,/\.internal/);
  assert.match(source,/SESSION_TTL/);
  assert.match(source,/persistSession/);
  assert.match(source,/execution context was destroyed/i);
  assert.match(source,/antiBotBypass:false/);
});
