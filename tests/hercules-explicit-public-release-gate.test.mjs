import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launch=readFileSync(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../supabase/migrations/20260927040500_add_explicit_public_release_gate.sql",import.meta.url),"utf8");
const passwordDefenseGate=readFileSync(new URL("../supabase/migrations/20260927180400_hercules_password_defense_launch_gate_v1.sql",import.meta.url),"utf8");

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


test("public launch exposes the Revenue Recovery marketing contract",()=>{
  assert.match(launch,/Recover cash\. Keep control\. Prove every action\./);
  assert.match(launch,/id="revenue-recovery"/);
  assert.match(launch,/id="proof-demo"/);
  assert.match(launch,/id="trust"/);
  assert.match(launch,/id="pilot"/);
  assert.match(launch,/Synthetic demo data/);
  assert.match(launch,/Request founding pilot/);
});

test("public launch instruments marketing and first verified value events",()=>{
  assert.match(launch,/marketing_event/);
  assert.match(launch,/pilot_request/);
  assert.match(launch,/first_verified_useful_action/);
  assert.match(launch,/event_source:"hercules-launch"/);
});

test("public launch preserves owner-bound legal and registration gates",()=>{
  assert.match(launch,/DRAFT — owner review required before general availability/);
  assert.match(launch,/Public account creation is not open yet/);
  assert.match(launch,/not being offered here as .*guaranteed recovery service/i);
});


test("organic proof surface includes Build Receipt 001",()=>{
  assert.match(launch,/Build Receipt #001/);
  assert.match(launch,/Three receivables\. Three safe routes\./);
  assert.match(launch,/id="build-receipt-001"/);
  assert.match(launch,/Request founding pilot/);
});


test("auth hardening is computed from live Hercules password defense evidence",()=>{
  assert.match(gate,/hercules_password_defense_status/);
  assert.match(gate,/password_defense_probe=compromised/);
  assert.match(gate,/commercial\.auth_hardening=passwordDefense\.ok/);
  assert.match(gate,/hercules-password-defense-v2/);
  assert.match(passwordDefenseGate,/hercules_password_defense_status/);
  assert.match(passwordDefenseGate,/hercules_password_screening_guard/);
  assert.match(passwordDefenseGate,/service_role_can_issue/);
  assert.match(passwordDefenseGate,/anon_can_issue/);
  assert.match(passwordDefenseGate,/authenticated_can_issue/);
});

test("native provider warning cannot by itself fail the Hercules auth gate",()=>{
  assert.doesNotMatch(gate,/requiredCommercial=\['auth_hardening','pricing','privacy','terms'\]/);
  assert.match(gate,/requiredOwnerCommercial=\['pricing','privacy','terms'\]/);
  assert.match(gate,/commercialOk=passwordDefense\.ok&&paymentProviderReady&&paymentPathVerified&&requiredOwnerCommercial\.every/);
});
