import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("public launch health is included as a critical monitored service",async()=>{
  const sql=await readFile(new URL("../supabase/migrations/20260928074000_hercules_launch_health_monitor_v1.sql",import.meta.url),"utf8");
  assert.match(sql,/hercules_service_registry/);
  assert.match(sql,/'hercules-launch'/);
  assert.match(sql,/\/functions\/v1\/hercules-launch\?health=1/);
  assert.match(sql,/'expected',\s*'json-ok'/);
  assert.match(sql,/critical\s*=\s*true/i);
});
