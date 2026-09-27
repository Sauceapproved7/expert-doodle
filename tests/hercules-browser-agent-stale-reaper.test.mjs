import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927072500_hercules_browser_agent_stale_reaper_v1.sql",import.meta.url),
  "utf8"
);

test("stale reaper only touches running incomplete runs",()=>{
  assert.match(sql,/where status='running'/);
  assert.match(sql,/completed_at is null/);
  assert.match(sql,/updated_at < v_now - interval '5 minutes'/);
});

test("stale reaper records an explicit terminal reason",()=>{
  assert.match(sql,/status='failed'/);
  assert.match(sql,/stale_runtime_timeout/);
  assert.match(sql,/reapedAt/);
  assert.match(sql,/completed_at=coalesce\(completed_at,v_now\)/);
});

test("stale reaper is service-role only",()=>{
  assert.match(sql,/revoke all on function public\.hercules_browser_agent_reap_stale\(\)/i);
  assert.match(sql,/grant execute on function public\.hercules_browser_agent_reap_stale\(\)[\s\S]*to service_role/i);
});

test("stale reaper is scheduled every five minutes",()=>{
  assert.match(sql,/hercules-browser-agent-stale-reaper/);
  assert.match(sql,/'\*\/5 \* \* \* \*'/);
  assert.match(sql,/cron\.unschedule/);
  assert.match(sql,/cron\.schedule/);
});
