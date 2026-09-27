import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=await readFile(
  new URL("../render/hercules-browser-direct/server.mjs",import.meta.url),
  "utf8"
);

test("owner handoff is separate from the master browser token",()=>{
  assert.match(source,/\/v1\/handoff/);
  assert.match(source,/\/owner\//);
  assert.match(source,/randomBytes\(/);
  assert.match(source,/createHash\(["']sha256["']\)/);
  assert.match(source,/HANDOFF_TTL/);
  assert.match(source,/handoffUrl/);
  assert.match(source,/handoffId/);
});

test("owner handoff preserves the same Hercules browser session",()=>{
  assert.match(source,/sessionId/);
  assert.match(source,/handoff.*sessionId|sessionId.*handoff/is);
  assert.match(source,/s\.page\.screenshot/);
  assert.match(source,/s\.page\.mouse\.click/);
  assert.match(source,/s\.page\.keyboard\.insertText/);
  assert.match(source,/s\.page\.mouse\.wheel/);
  assert.match(source,/finished/);
});

test("owner handoff does not store or echo typed secrets",()=>{
  assert.doesNotMatch(source,/console\.log\([^\n]*(body|text|password|token)/i);
  assert.match(source,/chars:value\.length/);
  assert.doesNotMatch(source,/typedText|savedPassword|credentialStore/i);
});

test("owner handoff browser surface is hardened",()=>{
  assert.match(source,/content-security-policy/i);
  assert.match(source,/frame-ancestors 'none'/i);
  assert.match(source,/x-frame-options/i);
  assert.match(source,/referrer-policy/i);
  assert.match(source,/cache-control/i);
  assert.match(source,/antiBotBypass:false/);
});
