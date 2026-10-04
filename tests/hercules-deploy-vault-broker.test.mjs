// Exact-head gate anchor: Vault broker implementation + governance records must verify together.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const brokerPath = new URL("../supabase/functions/hercules-deploy-broker/index.ts", import.meta.url);
const migrationPath = new URL("../supabase/migrations/20261004111500_hercules_deploy_vault_broker_v1.sql", import.meta.url);

test("Vault-backed deploy broker keeps provider credentials server-side and fail-closed", async () => {
  const source = await readFile(brokerPath, "utf8");
  assert.match(source, /hercules_internal_service_keys/);
  assert.match(source, /render-deployer/);
  assert.match(source, /hercules_get_secret/);
  assert.match(source, /https:\/\/api\.render\.com/);
  assert.match(source, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(source, /hercules_deploy_targets/);
  assert.match(source, /authorization:\s*['"]Bearer ['"]\s*\+/);
  assert.match(source, /\/health/);
  assert.match(source, /\/mcp/);
  assert.match(source, /\[401,403\]/);
});

test("Vault-backed deploy target registry is service-role only and allowlisted", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /create table if not exists public\.hercules_deploy_targets/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.hercules_deploy_targets from public, anon, authenticated/i);
  assert.match(migration, /grant select on table public\.hercules_deploy_targets to service_role/i);
  assert.match(migration, /do \\$\\$[\\s\\S]*end \\$\\$;/i);
  assert.match(migration, /gen_random_bytes\(32\)/i);
  assert.match(migration, /vault\.create_secret/i);
  assert.match(migration, /purpose='deploy-broker-control'/i);
  assert.match(migration, /'deploy-broker-control'/i);
  assert.match(migration, /'credential_custody','supabase_vault'/i);
  assert.match(migration, /'carries_credentials',false/i);
});
