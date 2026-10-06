import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(new URL("../supabase/migrations/20261006031500_hercules_single_active_owner_v1.sql",import.meta.url),"utf8");

test("Hercules permits at most one active owner per organization",()=>{
  assert.match(migration,/create\s+unique\s+index\s+if\s+not\s+exists\s+hercules_memberships_one_active_owner/i);
  assert.match(migration,/where\s+role\s*=\s*'owner'\s+and\s+status\s*=\s*'active'/i);
  assert.match(migration,/on\s+public\.hercules_memberships\s*\(organization_id\)/i);
});

test("migration refuses to install over an already-invalid owner state",()=>{
  assert.match(migration,/multiple_active_owners_exist/i);
});
