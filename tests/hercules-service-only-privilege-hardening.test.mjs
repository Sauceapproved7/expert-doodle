import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = "supabase/migrations/20261004013000_hercules_service_only_privilege_hardening_v1.sql";

const sensitiveServiceOnlyTables = [
  "hercules_app_deploy_tokens",
  "hercules_attestation_bootstrap_tokens",
  "hercules_backend_bootstrap_tokens",
  "hercules_execution_secret_grants",
  "hercules_internal_service_keys",
  "hercules_source_content_import_tokens",
  "hercules_trading_connect_tokens",
];

test("service-only sensitive tables revoke client privileges and preserve service role", () => {
  assert.equal(fs.existsSync(migration), true, "hardening migration must exist");
  const sql = fs.readFileSync(migration, "utf8").toLowerCase();

  for (const table of sensitiveServiceOnlyTables) {
    assert.match(sql, new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`, "i"));
    assert.match(sql, new RegExp(`grant\\s+select\\s*,\\s*insert\\s*,\\s*update\\s*,\\s*delete\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+service_role`, "i"));
  }
});
