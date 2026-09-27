import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const server=await readFile(new URL("../render/hercules-browser-standalone/server.mjs",import.meta.url),"utf8");
const edge=await readFile(new URL("../supabase/functions/hercules-browser/index.ts",import.meta.url),"utf8");
const cutover=await readFile(new URL("../supabase/migrations/20260927172500_hercules_browser_standalone_canonical_cutover_v1.sql",import.meta.url),"utf8");

test("standalone browser implements the canonical /v1/run worker contract",()=>{
  assert.match(server,/pathname===["']\/v1\/run["']/);
  assert.match(server,/navigate/);
  assert.match(server,/scrape/);
  assert.match(server,/screenshot/);
  assert.match(server,/interact/);
  assert.match(server,/close_session/);
  assert.match(server,/persistSession/);
  assert.match(server,/sessionId/);
  assert.match(server,/base64/);
  assert.match(server,/links/);
  assert.match(server,/maxTextChars/);
});

test("canonical worker contract remains fail closed on owner-controlled fields",()=>{
  assert.match(server,/ownerControlledField/);
  assert.match(server,/owner_action_required/);
  assert.match(server,/password/i);
  assert.match(server,/captcha/i);
  assert.match(server,/mfa/i);
  assert.match(server,/terms/i);
  assert.match(server,/consent/i);
  assert.match(server,/antiBotBypass:false/);
});

test("Hercules control plane mints a fresh one-time token for broker-auth workers",()=>{
  assert.match(edge,/one_time_broker/);
  assert.match(edge,/hercules_browser_standalone_token_issue/);
  assert.match(edge,/p_purpose:\s*["']runtime["']/);
  assert.match(edge,/p_ttl_seconds:\s*90/);
  assert.match(edge,/async function workerToken/);
  assert.match(edge,/await workerToken\(w\)/);
  assert.doesNotMatch(edge,/one_time_broker[\s\S]{0,600}hercules_get_secret/);
});

test("cutover promotes standalone and preserves explicit rollback metadata",()=>{
  assert.match(cutover,/https:\/\/hercules-browser-standalone\.onrender\.com/);
  assert.match(cutover,/"auth_mode"\s*:\s*"one_time_broker"/);
  assert.match(cutover,/"engine"\s*:\s*"playwright-local-chromium"/);
  assert.match(cutover,/"service_id"\s*:\s*"srv-daskfp8u01pc73cbvj0g"/);
  assert.match(cutover,/['"]rollback['"]/);
  assert.match(cutover,/hercules-browser-gateway-v2/);
  assert.match(cutover,/token_secret_ref/);
  assert.doesNotMatch(cutover,/anti_bot_bypass["']?\s*[:,]\s*true/i);
});
