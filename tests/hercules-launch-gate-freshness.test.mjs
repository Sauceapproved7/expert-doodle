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
