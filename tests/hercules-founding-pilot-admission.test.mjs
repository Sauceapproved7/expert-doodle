import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const control=await readFile(new URL("../supabase/functions/hercules-private-bridge/pilot-admission.ts",import.meta.url),"utf8");
const launch=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const handoff=await readFile(new URL("../supabase/functions/hercules-launch/pilot-admission.ts",import.meta.url),"utf8");
const publicGate=await readFile(new URL("../supabase/migrations/20260927040500_add_explicit_public_release_gate.sql",import.meta.url),"utf8");

test("pilot admission issuance is restricted to qualified protected contacts",()=>{
  assert.match(control,/pilot-qualification-v1/);
  assert.match(control,/controlled-us-b2b-receivables/);
  assert.match(control,/manages_own_receivables/);
  assert.match(control,/excluded_use_ack/);
  assert.match(control,/approval_gated_ack/);
  assert.match(control,/authorized_real/);
  assert.match(control,/synthetic/);
  assert.match(control,/opted_out/);
  assert.match(control,/owner_required|internal_authorization_required/);
});

test("handoff tokens are random, one-time, and only hashed at rest",()=>{
  assert.match(control,/crypto\.getRandomValues/);
  assert.match(control,/SHA-256/);
  assert.match(control,/token_sha256/);
  assert.doesNotMatch(control,/raw_token\s*:/);
  assert.match(handoff,/token_sha256/);
  assert.match(handoff,/status.*issued/);
  assert.match(handoff,/status.*redeeming/);
  assert.match(handoff,/status.*accepted/);
});

test("pilot GET is side-effect free and acceptance requires explicit POST",()=>{
  const getStart=handoff.indexOf("export async function pilotAdmissionGet");
  const nextFunction=handoff.indexOf("async function passwordDefense",getStart);
  const postStart=handoff.indexOf("export async function pilotAdmissionPost");
  assert.ok(getStart>=0&&nextFunction>getStart&&postStart>nextFunction);
  const getBlock=handoff.slice(getStart,nextFunction);
  assert.doesNotMatch(getBlock,/\.insert\(|\.update\(|\.delete\(|generateLink|verifyOtp|createUser/);
  assert.match(getBlock,/method=\"post\"/i);
  assert.match(handoff,/explicit_acceptance_required/);
  assert.match(launch,/pilot_admission/);
  assert.match(launch,/pilotAdmissionGet/);
  assert.match(launch,/pilotAdmissionPost/);
});

test("pilot acceptance keeps privileged credentials server-side and establishes first session from token hash",()=>{
  assert.match(handoff,/auth\.admin\.generateLink/);
  assert.match(handoff,/type:\s*['"]magiclink['"]/);
  assert.match(handoff,/hashed_token/);
  assert.match(handoff,/auth\.verifyOtp/);
  assert.match(handoff,/token_hash/);
  assert.match(handoff,/type:\s*['"]email['"]/);
  assert.doesNotMatch(handoff,/SUPABASE_SERVICE_ROLE_KEY[\s\S]*replaceAll/);
  assert.doesNotMatch(handoff,/SUPABASE_SECRET_KEYS[\s\S]*replaceAll/);
});

test("accepted pilots get an isolated organization without weakening public registration",()=>{
  assert.match(handoff,/hercules_organizations/);
  assert.match(handoff,/hercules_memberships/);
  assert.match(handoff,/founder_organization_forbidden/);
  assert.match(handoff,/sauceapproved/);
  assert.match(handoff,/pilot_admission_redeemed/);
  assert.match(publicGate,/public-registration-open/);
  assert.match(publicGate,/'{"open":false}'::jsonb/);
  assert.doesNotMatch(control,/value:\s*\{\s*open:\s*true/);
  assert.doesNotMatch(handoff,/hercules_continuity_ledger[\s\S]{0,220}\.update\(/);
});

test("Password Defense v2 remains authoritative before password sign-in readiness",()=>{
  assert.match(handoff,/hercules_password_defense_status/);
  assert.match(handoff,/hercules-password-defense-v2/);
  assert.match(handoff,/passwordSignInReady/);
  assert.doesNotMatch(handoff,/signInWithPassword/);
  assert.doesNotMatch(handoff,/password\s*:/);
});

test("synthetic certification cannot invite a real prospect or activate paid billing",()=>{
  assert.match(control,/synthetic_certification/);
  assert.ok(control.includes("@example\\.com"));
  assert.match(control,/synthetic_only/);
  assert.doesNotMatch(control,/stripe|checkout/i);
  assert.doesNotMatch(handoff,/stripe|checkout/i);
  assert.match(control,/paidBillingActivated:false/);
  assert.match(handoff,/paid_billing:false/);
});

test("pilot control uses the dedicated Vault-backed service-key purpose and sanitized events",()=>{
  assert.match(control,/pilot-admission-control/);
  assert.match(control,/hercules_internal_service_keys/);
  assert.match(control,/hercules_get_secret/);
  assert.match(control,/pilot_admission_issued/);
  assert.match(handoff,/pilot_admission_accepted/);
  assert.doesNotMatch(control,/properties:\s*\{[^}]*token/i);
  assert.doesNotMatch(handoff,/properties:\s*\{[^}]*token/i);
});
