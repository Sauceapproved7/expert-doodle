import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const MIGRATION = new URL(
  "../supabase/migrations/20260927094311_hercules_browser_autoresume_v1.sql",
  import.meta.url,
);

test("browser autoresume is service-role only and always requires a target URL", async () => {
  const sql = await readFile(MIGRATION, "utf8");

  assert.match(sql, /create or replace function public\.hercules_browser_autoresume\(p_request jsonb\)/i);
  assert.match(sql, /browser_autoresume_url_required/);
  assert.match(sql, /browser_url_protocol_not_allowed/);
  assert.match(sql, /revoke all on function public\.hercules_browser_autoresume\(jsonb\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.hercules_browser_autoresume\(jsonb\) to service_role/i);
});

test("browser autoresume only reuses a recent same-host session", async () => {
  const sql = await readFile(MIGRATION, "utf8");

  assert.match(sql, /completed_at >= now\(\) - interval '9 minutes'/);
  assert.match(sql, /result->'summary'->>'sessionId'/);
  assert.match(sql, /v_host/);
  assert.match(sql, /order by r\.completed_at desc/);
});

test("browser autoresume keeps the target URL while adding session reuse", async () => {
  const sql = await readFile(MIGRATION, "utf8");

  assert.match(sql, /v_request := p_request \|\| jsonb_build_object\('persistSession', true\)/);
  assert.match(sql, /jsonb_build_object\('sessionId', v_session_id\)/);
  assert.match(sql, /return public\.hercules_browser_submit\(v_request\)/);
});
