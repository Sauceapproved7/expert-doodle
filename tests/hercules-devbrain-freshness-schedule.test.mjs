import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=new URL("../supabase/migrations/20260928073000_hercules_devbrain_freshness_schedule_v1.sql",import.meta.url);
const devbrain=new URL("../supabase/functions/hercules-devbrain-fabric/index.ts",import.meta.url);

test("DevBrain refresh is scheduled with Vault custody and a private submitter",async()=>{
  const sql=await readFile(migration,"utf8");
  assert.match(sql,/CREATE OR REPLACE FUNCTION private\.hercules_devbrain_refresh_submit\(\)/i);
  assert.match(sql,/purpose\s*=\s*'agent-coordinator'/i);
  assert.match(sql,/hercules_get_secret\(v_ref\)/i);
  assert.match(sql,/functions\/v1\/hercules-devbrain-fabric/);
  assert.match(sql,/REVOKE ALL ON FUNCTION private\.hercules_devbrain_refresh_submit\(\) FROM PUBLIC, anon, authenticated/i);
  assert.match(sql,/cron\.schedule\(\s*'hercules-devbrain-freshness',\s*'15 \*\/12 \* \* \*'/i);
  assert.doesNotMatch(sql,/\b(?:password|secret|token)\s*=\s*'[A-Za-z0-9_-]{20,}'/i);
});

test("scheduled refresh never places the internal key in pg_net request headers",async()=>{
  const sql=await readFile(migration,"utf8");
  assert.match(sql,/hmac\(/i);
  assert.match(sql,/x-hercules-cron-timestamp/i);
  assert.match(sql,/x-hercules-cron-signature/i);
  assert.doesNotMatch(sql,/x-hercules-internal-key/i);
});

test("DevBrain accepts only a fresh HMAC-signed scheduler request as the cron alternative",async()=>{
  const source=await readFile(devbrain,"utf8");
  assert.match(source,/x-hercules-cron-timestamp/i);
  assert.match(source,/x-hercules-cron-signature/i);
  assert.match(source,/agent-coordinator/);
  assert.match(source,/crypto\.subtle\.(?:verify|sign)/);
  assert.match(source,/scheduler_signature_expired|scheduler_signature_invalid/);
});
