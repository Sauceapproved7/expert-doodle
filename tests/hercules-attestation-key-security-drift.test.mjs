import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = 'supabase/migrations/20261004033000_hercules_attestation_key_security_drift_v1.sql';

test('attestation key registry is service-only and force-RLS protected', () => {
  assert.equal(fs.existsSync(migration), true, 'hardening migration must exist');
  const sql = fs.readFileSync(migration, 'utf8').toLowerCase();
  assert.match(sql, /alter table public\.hercules_attestation_keys force row level security/);
  assert.match(sql, /revoke all on table public\.hercules_attestation_keys from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on table public\.hercules_attestation_keys to service_role/);
});
