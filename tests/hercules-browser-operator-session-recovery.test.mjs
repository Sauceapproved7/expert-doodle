import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const browser=await readFile(
  new URL("../supabase/functions/hercules-browser/index.ts",import.meta.url),
  "utf8"
);

test("operator browser retries one dead reused session with a fresh session",()=>{
  assert.match(browser,/function transientClosedSession\(/);
  assert.match(browser,/target page, context or browser has been closed/i);
  assert.match(browser,/sessionRecoveryAttempts/);
  assert.match(browser,/delete freshPayload\.sessionId/);
  assert.match(browser,/freshPayload\.persistSession=true/);
  assert.match(browser,/sessionRecovered:true/);
});

test("operator browser never treats anti-bot challenges as recoverable session failure",()=>{
  assert.doesNotMatch(browser,/captcha.*transientClosedSession/i);
  assert.doesNotMatch(browser,/cloudflare.*transientClosedSession/i);
});
