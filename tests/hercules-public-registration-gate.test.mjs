import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launch=readFileSync(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../supabase/migrations/20260927034000_gate_public_registration.sql",import.meta.url),"utf8");

test("launch surface hides public signup until the launch gate is ready",()=>{
  assert.match(launch,/publicSignupOpen=false/);
  assert.match(launch,/hercules-launch-gate/);
  assert.match(launch,/lastCheck\?\.launch_ready===true/);
  assert.match(launch,/Early access — sign-in only/);
});

test("workspace bootstrap independently blocks unlaunched public registration",()=>{
  assert.match(migration,/hercules_launch_gate_checks/);
  assert.match(migration,/public registration is not open/);
  assert.match(migration,/existing_member/);
  assert.match(migration,/hercules-onboard-%@example\.com/);
});

test("launch sidebar exposes one canonical wallet entry",()=>{
  const matches=launch.match(/href="\/hercules-wallet\/"/g) ?? [];
  assert.equal(matches.length,1);
  assert.match(launch,/Wallet · Testnet/);
});
