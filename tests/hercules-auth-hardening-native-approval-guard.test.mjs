import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927180000_auth_hardening_native_approval_guard_v1.sql",import.meta.url),
  "utf8"
);

test("auth_hardening approval requires native Supabase verification evidence",()=>{
  assert.match(sql,/create or replace function public\.hercules_guard_auth_hardening_native_approval/i);
  assert.match(sql,/new\.approval_type\s*=\s*'auth_hardening'/i);
  assert.match(sql,/new\.status\s*=\s*'approved'/i);
  assert.match(sql,/nativeVerification,leakedPasswordProtectionEnabled/i);
  assert.match(sql,/nativeVerification,advisorWarningPresent/i);
  assert.match(sql,/auth_hardening_native_verification_required/i);
});

test("guard is enforced on direct inserts and updates to launch approvals",()=>{
  assert.match(sql,/before insert or update on public\.hercules_launch_approvals/i);
  assert.match(sql,/execute function public\.hercules_guard_auth_hardening_native_approval\(\)/i);
});

test("compensating-control evidence alone cannot satisfy the native gate",()=>{
  assert.doesNotMatch(sql,/compensatingControl[\s\S]{0,300}return new/i);
  assert.doesNotMatch(sql,/verified_compensating_control[\s\S]{0,300}return new/i);
});
