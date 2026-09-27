import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const MIGRATION = new URL(
  "../supabase/migrations/20260927033800_hercules_browser_operator_bridge_v1.sql",
  import.meta.url,
);

test("browser operator bridge is server-only and uses browser-gateway custody", async () => {
  const sql = await readFile(MIGRATION, "utf8");

  assert.match(sql, /create or replace function public\.hercules_browser_submit\(p_request jsonb\)/i);
  assert.match(sql, /create or replace function public\.hercules_browser_result\(p_request_id bigint\)/i);
  assert.match(sql, /purpose = 'browser-gateway'/);
  assert.match(sql, /hercules_get_secret/);
  assert.match(sql, /functions\/v1\/hercules-browser/);
  assert.match(sql, /grant execute on function public\.hercules_browser_submit\(jsonb\) to service_role/i);
  assert.match(sql, /grant execute on function public\.hercules_browser_result\(bigint\) to service_role/i);
  assert.match(sql, /revoke all on function public\.hercules_browser_submit\(jsonb\) from public, anon, authenticated/i);
  assert.match(sql, /revoke all on function public\.hercules_browser_result\(bigint\) from public, anon, authenticated/i);
});

test("browser operator bridge constrains request shape and action surface", async () => {
  const sql = await readFile(MIGRATION, "utf8");

  assert.match(sql, /262144/);
  assert.match(sql, /navigate','scrape','screenshot','interact','close_session/);
  assert.match(sql, /click','type','wait','extract/);
  assert.match(sql, /jsonb_array_length\(v_steps\) > 25/);
  assert.match(sql, /browser_timeout_out_of_range/);
  assert.match(sql, /browser_url_protocol_not_allowed/);
});

test("browser operator bridge does not hardcode gateway credentials", async () => {
  const sql = await readFile(MIGRATION, "utf8");

  assert.doesNotMatch(sql, /Bearer\s+[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(sql, /TOKEN\s*[:=]\s*['"][^'"]+/i);
  assert.doesNotMatch(sql, /service_role_key\s*[:=]\s*['"][^'"]+/i);
  assert.match(sql, /v_internal_key := null/);
});
