import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(new URL("../supabase/migrations/20261013133000_hercules_public_registration_freshness_guard_v1.sql",import.meta.url),"utf8");

test("workspace registration requires recent launch evidence rather than a historical green",()=>{
  assert.match(sql,/create or replace function public\.hercules_bootstrap_organization\(org_name text, org_slug text\)/i);
  assert.match(sql,/g\.launch_ready\s*=\s*true/i);
  assert.match(sql,/g\.checked_at\s*>=\s*now\(\)\s*-\s*interval\s+'30 minutes'/i);
  assert.match(sql,/g\.checked_at\s*<=\s*now\(\)\s*\+\s*interval\s+'1 minute'/i);
  assert.match(sql,/order by g\.checked_at desc\s+limit 1/i);
  assert.match(sql,/coalesce\(\(/i);
});
test("existing active members and synthetic isolated certification bypass retained",()=>{
  assert.match(sql,/from public\.hercules_memberships m[\s\S]*m\.user_id=uid[\s\S]*m\.status='active'/i);
  assert.match(sql,/synthetic_e2e\s*:=\s*owner_email like 'hercules-onboard-%@example\.com'/);
  assert.match(sql,/if not \(launch_ready and public_open\)\s+and not existing_member\s+and not synthetic_e2e/i);
  assert.match(sql,/email confirmation required/);
  assert.match(sql,/reserved organization slug/);
});
test("public registration remains explicitly owner gated, no switch or payment mutations",()=>{
  assert.match(sql,/l\.status='active' and l\.value->>'open'='true'/);
  assert.match(sql,/where l\.key='public-registration-open'/);
  assert.doesNotMatch(sql,/(update|delete from)\s+public\.hercules_continuity_ledger/i);
  assert.doesNotMatch(sql,/(update|delete from)\s+public\.hercules_launch_gate_checks/i);
  assert.doesNotMatch(sql,/(stripe|shopify|checkout|billing)/i);
});
test("migration verifies fresh timestamp binding and preserves original privilege boundary",()=>{
  assert.match(sql,/security definer/i);
  assert.match(sql,/set search_path to 'public', 'auth'/i);
  assert.match(sql,/pg_get_functiondef/i);
  assert.match(sql,/raise exception 'registration_freshness_guard_missing'/i);
  assert.match(sql,/begin;[\s\S]*commit;/i);
});
