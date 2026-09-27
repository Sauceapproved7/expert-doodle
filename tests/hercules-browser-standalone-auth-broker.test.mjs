import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927165000_hercules_browser_standalone_auth_broker_v1.sql",import.meta.url),
  "utf8"
);
const edge=await readFile(
  new URL("../supabase/functions/hercules-browser-standalone-auth/index.ts",import.meta.url),
  "utf8"
);

test("broker stores only token hashes in the private schema",()=>{
  assert.match(migration,/create table if not exists private\.hercules_browser_standalone_tokens/i);
  assert.match(migration,/token_sha256 text primary key/i);
  assert.match(migration,/expires_at timestamptz not null/i);
  assert.match(migration,/consumed_at timestamptz/i);
  assert.doesNotMatch(migration,/token\s+text\s+not null/i);
});

test("token issue and consume are service-role-only and replay safe",()=>{
  assert.match(migration,/hercules_browser_standalone_token_issue/i);
  assert.match(migration,/hercules_browser_standalone_token_consume/i);
  assert.match(migration,/gen_random_bytes\(32\)/i);
  assert.match(migration,/digest\(p_token,'sha256'\)/i);
  assert.match(migration,/consumed_at is null/i);
  assert.match(migration,/expires_at > now\(\)/i);
  assert.match(migration,/revoke all on function public\.hercules_browser_standalone_token_issue/i);
  assert.match(migration,/grant execute on function public\.hercules_browser_standalone_token_issue[^;]*to service_role/is);
  assert.match(migration,/grant execute on function public\.hercules_browser_standalone_token_consume[^;]*to service_role/is);
});

test("dispatcher keeps bearer tokens inside Supabase and only permits browser API paths",()=>{
  assert.match(migration,/hercules_browser_standalone_dispatch/i);
  assert.match(migration,/https:\/\/hercules-browser-standalone\.onrender\.com/i);
  assert.match(migration,/net\.http_post/i);
  assert.match(migration,/authorization.*Bearer/is);
  assert.match(migration,/\/api\/autopilot/);
  assert.match(migration,/\/api\/navigate/);
  assert.match(migration,/\/api\/action/);
  assert.match(migration,/\/api\/new-session/);
});

test("public verifier validates format and consumes via service-role RPC",()=>{
  assert.match(edge,/verify_jwt/i);
  assert.match(edge,/hercules_browser_standalone_token_consume/);
  assert.match(edge,/^[^\n]*token/i);
  assert.match(edge,/service_role|SUPABASE_SECRET_KEYS|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(edge,/console\.log\([^\n]*token/i);
});
