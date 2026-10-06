import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20261006030000_one_active_owner_per_org.sql",import.meta.url),
  "utf8"
);

test("membership owner invariant fails closed on existing duplicate active owners",()=>{
  assert.match(migration,/having count\(\*\) > 1/i);
  assert.match(migration,/multiple_active_owners_detected/);
});

test("membership owner invariant permits only one active owner per organization",()=>{
  assert.match(migration,/create unique index if not exists hercules_memberships_one_active_owner_per_org/i);
  assert.match(migration,/on public\.hercules_memberships \(organization_id\)/i);
  assert.match(migration,/where role='owner' and status='active'/i);
});
