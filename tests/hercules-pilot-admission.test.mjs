import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const admission=await readFile(new URL("../supabase/functions/hercules-private-bridge/pilot-admission.ts",import.meta.url),"utf8");
const launch=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const keyProvisioning=await readFile(new URL("../hercules-deploy/pilot-admission-control-key.sql",import.meta.url),"utf8");

test("pilot admission issuance is internal-only and qualification-bound",()=>{
  assert.match(bridge,/isPilotAdmissionAction/);
  assert.match(bridge,/handlePilotAdmissionRequest/);
  assert.match(admission,/pilot-admission-control/);
  assert.match(admission,/x-hercules-internal-key/);
  assert.match(admission,/pilot-qualification-v1/);
  assert.match(admission,/manages_own_receivables/);
  assert.match(admission,/excluded_use_ack/);
  assert.match(admission,/approval_gated_ack/);
  assert.match(admission,/data_mode/);
  assert.match(admission,/unsubscribed/);
});

test("pilot handoff is random, hash-only at rest, expiring, and scanner-safe",()=>{
  assert.match(admission,/crypto\.getRandomValues/);
  assert.match(admission,/pilot_admission_token_sha256/);
  assert.match(admission,/pilot_admission_expires_at/);
  assert.match(admission,/pilot_admission_status/);
  assert.doesNotMatch(admission,/pilot_admission_token[^_]/);
  assert.match(launch,/pilot_accept/);
  assert.match(launch,/pilot_admission_accept/);
  assert.match(launch,/method:"POST"/);
  assert.doesNotMatch(launch,/if\(req\.method==="GET"\)[\s\S]{0,500}pilot_admission_accept/);
});

test("accepted pilot receives server-created auth session without opening public signup",()=>{
  assert.match(launch,/admin\.auth\.admin\.createUser/);
  assert.match(launch,/email_confirm:true/);
  assert.match(launch,/app_metadata/);
  assert.match(launch,/hercules_controlled_pilot/);
  assert.match(launch,/admin\.auth\.admin\.generateLink/);
  assert.match(launch,/type:"magiclink"/);
  assert.match(launch,/hashed_token/);
  assert.match(launch,/verifyOtp/);
  assert.match(launch,/token_hash/);
  assert.match(launch,/type:"email"/);
  assert.match(launch,/publicRegistrationOpen/);
  assert.doesNotMatch(launch,/publicRegistrationOpen\s*=\s*true/);
});

test("pilot organization creation is isolated and preserves existing provisioning invariants",()=>{
  assert.match(launch,/hercules_memberships/);
  assert.match(launch,/hercules_organizations/);
  assert.match(launch,/owner_user_id/);
  assert.match(launch,/controlled_pilot_admission/);
  assert.match(launch,/pilot_admission_organization_id/);
  assert.doesNotMatch(launch,/ea5fb196-67f9-42fa-b592-49eeb3b84346/);
});

test("pilot admission requires password hardening before normal entry",()=>{
  assert.match(launch,/pilotSetPassword/);
  assert.match(launch,/secure_change_password/);
  assert.match(launch,/Password Defense/i);
  assert.match(launch,/pilotPassword/);
  assert.match(launch,/bootApp/);
});

test("dedicated pilot admission key is Vault-backed and never stored plaintext",()=>{
  assert.match(keyProvisioning,/pilot-admission-control/);
  assert.match(keyProvisioning,/hercules_store_secret/);
  assert.match(keyProvisioning,/key_sha256/);
  assert.match(keyProvisioning,/secret_ref/);
  assert.match(keyProvisioning,/gen_random_bytes/);
  assert.match(keyProvisioning,/v_internal_key := null/);
  assert.doesNotMatch(keyProvisioning,/metadata[\s\S]{0,300}v_internal_key/i);
});
