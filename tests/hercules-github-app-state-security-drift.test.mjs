import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = 'supabase/migrations/20261004030000_hercules_github_app_state_security_drift_v1.sql';

test('GitHub App OAuth state remains backend-only', () => {
  assert.ok(fs.existsSync(migration), 'security reconciliation migration must exist');
  const sql = fs.readFileSync(migration, 'utf8').toLowerCase();

  assert.match(sql, /alter table public\.hercules_github_app_states force row level security/);
  assert.match(sql, /revoke all on table public\.hercules_github_app_states from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on table public\.hercules_github_app_states to service_role/);
});
