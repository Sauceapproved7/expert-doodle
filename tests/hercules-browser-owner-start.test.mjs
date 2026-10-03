import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../render/hercules-browser-direct/server.mjs",import.meta.url),"utf8");
test("owner start link is one-time short-lived and target-bound",()=>{
  assert.match(source,/HERCULES_OWNER_START_TOKEN/);
  assert.match(source,/HERCULES_OWNER_START_URL/);
  assert.match(source,/OWNER_START_TTL/);
  assert.match(source,/ownerStartConsumed/);
  assert.match(source,/\/owner-start\//);
  assert.match(source,/safeUrl\(OWNER_START_URL\)/);
  assert.doesNotMatch(source,/url\.searchParams\.get\(["']url["']\)/);
});
test("owner start creates a persistent session then redirects into the existing secure handoff",()=>{
  assert.match(source,/persistSession:true/);
  assert.match(source,/createHandoff\(req,.*sessionId/);
  assert.match(source,/writeHead\(302/);
  assert.match(source,/location.*handoffUrl/i);
});
test("owner start token is not exposed in health or response payloads",()=>{
  assert.doesNotMatch(source,/ownerStartToken\s*:/i);
  assert.doesNotMatch(source,/HERCULES_OWNER_START_TOKEN[^\n]*reply/i);
  assert.match(source,/ownerHandoff:true/);
});
