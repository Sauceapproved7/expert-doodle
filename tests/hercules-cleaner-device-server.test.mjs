import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const sql=await readFile(new URL("../supabase/migrations/20260929122000_hercules_cleaner_device_activation_v1.sql",import.meta.url),"utf8");
const edge=await readFile(new URL("../supabase/functions/hercules-cleaner-device/index.ts",import.meta.url),"utf8");

test("Cleaner device registry stores hashes/public identity only and has no filesystem inventory columns",()=>{
  assert.match(sql,/create table if not exists public\.hercules_cleaner_activation_codes/i);
  assert.match(sql,/code_sha256 text not null unique/i);
  assert.match(sql,/create table if not exists public\.hercules_cleaner_devices/i);
  assert.match(sql,/public_key_pem text not null/i);
  assert.match(sql,/credential_sha256 text not null unique/i);
  assert.match(sql,/create table if not exists public\.hercules_cleaner_device_challenges/i);
  assert.doesNotMatch(sql,/\b(file_name|filename|file_path|filepath|recovery_capsule|cleanup_inventory|hostname|serial_number|mac_address|username)\b/i);
});

test("device tables are RLS protected and not directly exposed to anon/authenticated roles",()=>{
  assert.match(sql,/hercules_cleaner_activation_codes enable row level security/i);
  assert.match(sql,/hercules_cleaner_devices enable row level security/i);
  assert.match(sql,/hercules_cleaner_device_challenges enable row level security/i);
  assert.match(sql,/revoke all on public\.hercules_cleaner_activation_codes from anon, authenticated/i);
  assert.match(sql,/revoke all on public\.hercules_cleaner_devices from anon, authenticated/i);
  assert.match(sql,/revoke all on public\.hercules_cleaner_device_challenges from anon, authenticated/i);
});

test("activation RPC consumes one-time code atomically and stores credential hash rather than plaintext",()=>{
  assert.match(sql,/create or replace function public\.hercules_activate_cleaner_device/i);
  assert.match(sql,/for update/i);
  assert.match(sql,/used_at is null/i);
  assert.match(sql,/credential_sha256/i);
  assert.match(sql,/update public\.hercules_cleaner_activation_codes[\s\S]*used_at\s*=\s*now\(\)/i);
  assert.doesNotMatch(sql,/device_credential text/i);
});

test("edge function has owner-only code issuance and public challenge/finish actions",()=>{
  assert.match(edge,/issue_activation_code/);
  assert.match(edge,/ownerAuth/);
  assert.match(edge,/registration_challenge/);
  assert.match(edge,/activate_device/);
  assert.match(edge,/crypto\.subtle\.verify/);
  assert.match(edge,/SHA-256/);
  assert.match(edge,/service_role/i);
});

test("edge API rejects sensitive local filesystem fields",()=>{
  assert.match(edge,/SENSITIVE_FIELDS/);
  for(const field of ["file","path","capsule","hostname","serial","mac","username"]){
    assert.match(edge,new RegExp(field,"i"));
  }
  assert.match(edge,/sensitive_device_metadata_rejected/);
});

test("activation endpoint never auto-enables commerce",()=>{
  assert.doesNotMatch(edge,/checkout_enabled\s*[:=]\s*true/i);
  assert.doesNotMatch(sql,/checkout_enabled\s*=\s*true/i);
  assert.doesNotMatch(sql,/pricing_status\s*=\s*'approved'/i);
});
