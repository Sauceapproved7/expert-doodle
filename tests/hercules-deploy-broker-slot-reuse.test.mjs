import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const brokerPath = new URL("../supabase/functions/hercules-deployment-broker/index.ts", import.meta.url);
const migrationPath = new URL("../supabase/migrations/20261004113000_hercules_deploy_broker_slot_reuse_v1.sql", import.meta.url);

test("existing deployment broker slot owns the Vault-backed Render actions without broadening legacy authorization", async () => {
  const source = await readFile(brokerPath, "utf8");
  assert.match(source, /vault_render_status/);
  assert.match(source, /vault_render_deploy/);
  assert.match(source, /vault_render_verify/);
  assert.match(source, /vault_render_rollback/);
  assert.match(source, /deploy-broker-control/);
  assert.match(source, /deployment-broker/);
  assert.match(source, /render-deployer/);
  assert.match(source, /hercules_deploy_targets/);
  assert.match(source, /^const RENDER_API='https:\/\/api\.render\.com';$/m);
  assert.match(source, /\/health/);
  assert.match(source, /\/mcp/);
  assert.match(source, /\[401,403\]/);
});

test("follow-up migration routes broker submissions into the existing deployment-broker slot", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /functions\/v1\/hercules-deployment-broker/);
  assert.match(migration, /vault_render_/);
  assert.match(migration, /purpose='deploy-broker-control'/);
  assert.doesNotMatch(migration, /functions\/v1\/hercules-deploy-broker['"]/);
});
