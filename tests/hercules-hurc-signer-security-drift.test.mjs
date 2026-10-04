import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL(
  "../supabase/migrations/20261004023000_hercules_hurc_signer_security_drift_v1.sql",
  import.meta.url,
);

test("HURC signer drift repair preserves the canonical server-only contract", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.hercules_hurc_test_signers force row level security/i);
  assert.match(sql, /revoke all on table public\.hercules_hurc_test_signers from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.hercules_hurc_test_signers to service_role/i);
});
