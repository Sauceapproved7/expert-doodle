import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launch=readFileSync(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../supabase/migrations/20260927040500_add_explicit_public_release_gate.sql",import.meta.url),"utf8");

test("launch surface requires both launch readiness and explicit public release",()=>{
  assert.match(launch,/lastCheck\?\.launch_ready===true&&d\?\.publicRegistrationOpen===true/);
  assert.match(launch,/manual-release-gated/);
});

test("launch gate exposes explicit public registration state",()=>{
  assert.match(gate,/public-registration-open/);
  assert.match(gate,/publicRegistrationOpen/);
  assert.match(gate,/status==='active'/);
});

test("workspace bootstrap is fail-closed until explicit release",()=>{
  assert.match(migration,/launch_ready and public_open/);
  assert.match(migration,/public-registration-open/);
  assert.match(migration,/'held'/);
  assert.match(migration,/'\{"open":false\}'::jsonb/);
});

test("synthetic launch certification remains available while public signup stays closed",()=>{
  assert.match(migration,/hercules-onboard-%@example\.com/);
  assert.match(migration,/synthetic_e2e/);
});
