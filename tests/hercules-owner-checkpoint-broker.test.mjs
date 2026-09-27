import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260927162000_hercules_owner_checkpoint_broker_v1.sql", import.meta.url),
  "utf8"
);

test("owner checkpoint broker is private and durable", () => {
  assert.match(migration,/create table if not exists private\.hercules_owner_checkpoints/i);
  assert.match(migration,/checkpoint_key text primary key/i);
  assert.match(migration,/status text not null default 'pending_owner_auth'/i);
  assert.match(migration,/attempt_count integer not null default 0/i);
  assert.match(migration,/next_action jsonb not null/i);
  assert.match(migration,/evidence jsonb not null default '\{\}'::jsonb/i);
  assert.doesNotMatch(migration,/create table[^;]*public\.hercules_owner_checkpoints/i);
});

test("broker marks readiness only from legitimate active provider evidence", () => {
  assert.match(migration,/create or replace function private\.hercules_owner_checkpoint_refresh_one/i);
  assert.match(migration,/from public\.hercules_provider_connections/i);
  assert.match(migration,/p\.status\s*=\s*'active'/i);
  assert.match(migration,/p\.connected_at is not null/i);
  assert.match(migration,/p\.access_secret_ref is not null/i);
  assert.doesNotMatch(migration,/security definer/i);
});

test("broker refreshes pending checkpoints automatically", () => {
  assert.match(migration,/create or replace function private\.hercules_owner_checkpoint_refresh_all/i);
  assert.match(migration,/cron\.schedule/i);
  assert.match(migration,/hercules-owner-checkpoint-broker/i);
  assert.match(migration,/\*\/5 \* \* \* \*/);
});

test("DA-24 LinkedIn checkpoint is seeded without fabricating authorization", () => {
  assert.match(migration,/DA-24:linkedin-owner-auth/);
  assert.match(migration,/'linkedin'/i);
  assert.match(migration,/'pending_owner_auth'/i);
  assert.match(migration,/Metricool/i);
  assert.doesNotMatch(migration,/status\s*=\s*'ready'[^;]*DA-24/is);
});
