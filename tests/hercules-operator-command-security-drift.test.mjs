import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration="supabase/migrations/20261004040000_hercules_operator_command_security_drift_v1.sql";

test("operator command store remains server-only", () => {
  assert.equal(fs.existsSync(migration), true, "hardening migration must exist");
  const sql=fs.readFileSync(migration,"utf8").toLowerCase();
  assert.match(sql,/alter table public\.hercules_operator_commands force row level security/);
  assert.match(sql,/revoke all on table public\.hercules_operator_commands from public, anon, authenticated/);
  assert.match(sql,/grant select, insert, update, delete on table public\.hercules_operator_commands to service_role/);
});
