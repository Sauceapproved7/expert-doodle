import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const migration=readFileSync(resolve(root,"supabase/migrations/20260930022000_hercules_launch_gate_freshness_v1.sql"),"utf8");

test("launch gate freshness scheduler keeps credentials server-side and refreshes every 10 minutes",()=>{
  assert.match(migration,/private\.hercules_launch_gate_refresh_submit/);
  assert.match(migration,/SECURITY DEFINER/i);
  assert.match(migration,/purpose\s*=\s*'agent-coordinator'/i);
  assert.match(migration,/hercules_get_secret/);
  assert.match(migration,/functions\/v1\/hercules-launch-gate/);
  assert.match(migration,/x-hercules-internal-key/);
  assert.match(migration,/\*\/10 \* \* \* \*/);
  assert.match(migration,/REVOKE ALL ON FUNCTION private\.hercules_launch_gate_refresh_submit\(\)/i);
});

test("migration immediately submits one fresh launch-gate check",()=>{
  assert.match(migration,/SELECT private\.hercules_launch_gate_refresh_submit\(\);/);
});


test("DA-11 restore selects the existing rotated_at key timestamp, not a nonexistent updated_at",()=>{
  const restored=readFileSync(resolve(root,"supabase/migrations/20261013131500_hercules_launch_gate_freshness_restore_v2.sql"),"utf8");
  assert.match(restored,/where purpose\s*=\s*'agent-coordinator'[\s\S]*?order by rotated_at desc nulls last/i);
  assert.doesNotMatch(restored,/order by updated_at desc/i);
  assert.match(restored,/private\.hercules_launch_gate_refresh_submit/);
  assert.match(restored,/revoke all on function private\.hercules_launch_gate_refresh_submit\(\)[\s\S]*?from public,\s*anon,\s*authenticated/i);
  assert.match(restored,/grant execute on function private\.hercules_launch_gate_refresh_submit\(\)[\s\S]*?to service_role/i);
  assert.match(restored,/select cron\.schedule\([\s\S]*?'hercules-launch-gate-freshness'[\s\S]*?'\*\/10 \* \* \* \*'/i);
  assert.match(restored,/select private\.hercules_launch_gate_refresh_submit\(\);/i);
  assert.doesNotMatch(restored,/\b(?:drop|truncate)\s+(?:table|schema)\b/i);
});
