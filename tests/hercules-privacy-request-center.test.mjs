import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927181500_hercules_privacy_request_center_v1.sql",import.meta.url),
  "utf8"
);
const launch=await readFile(
  new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),
  "utf8"
);
const privacy=await readFile(
  new URL("../docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md",import.meta.url),
  "utf8"
);

test("privacy requests have a dedicated fail-closed queue",()=>{
  assert.match(migration,/create table if not exists public\.hercules_privacy_requests/i);
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/requester_verified boolean not null default false/i);
  assert.match(migration,/status text not null default 'new'/i);
  assert.match(migration,/category text not null/i);
  assert.match(migration,/public_reference uuid not null default gen_random_uuid\(\)/i);
  assert.match(migration,/revoke all on table public\.hercules_privacy_requests from anon, authenticated/i);
  assert.doesNotMatch(migration,/grant .*hercules_privacy_requests.*anon|grant .*hercules_privacy_requests.*authenticated/i);
});

test("public request intake validates, throttles, and does not collect secrets",()=>{
  assert.match(launch,/PRIVACY_REQUEST_CATEGORIES/);
  assert.match(launch,/action==="privacy_request"/);
  assert.match(launch,/recentPrivacyRequestCount/);
  assert.match(launch,/privacy_request_rate_limited/);
  assert.match(launch,/requester_verified:false/);
  assert.match(launch,/privacyForm/);
  assert.match(launch,/privacyWebsite/);
  assert.match(launch,/privacyRequestType/);
  assert.match(launch,/privacyMessage/);
  assert.doesNotMatch(launch,/privacy.*password|password.*privacy/i);
  assert.doesNotMatch(launch,/privacy.*social_security|social_security.*privacy/i);
});

test("privacy candidate exposes a monitored in-product request channel",()=>{
  assert.match(privacy,/Hercules Privacy Request Center/i);
  assert.match(privacy,/access, export, correction, deletion/i);
  assert.doesNotMatch(privacy,/smallzshon@gmail\.com/i);
});


const executionMigration=await readFile(
  new URL("../supabase/migrations/20260927203000_hercules_privacy_data_rights_execution_v1.sql",import.meta.url),
  "utf8"
);
const privacyOps=await readFile(
  new URL("../supabase/functions/hercules-privacy-ops/index.ts",import.meta.url),
  "utf8"
);

test("verified privacy exports are service-role-only and preserve protected records",()=>{
  assert.match(executionMigration,/hercules_privacy_request_export/i);
  assert.match(executionMigration,/requester_verified/i);
  assert.match(executionMigration,/revoke all on function public\.hercules_privacy_request_export\(uuid\) from public, anon, authenticated/i);
  assert.match(executionMigration,/protected_not_included/i);
  assert.doesNotMatch(executionMigration,/delete from public\.hercules_audit_log/i);
  assert.doesNotMatch(executionMigration,/delete from public\.hercules_security_events/i);
});

test("privacy deletion execution is exact-request-bound and fail closed",()=>{
  assert.match(executionMigration,/hercules_privacy_request_delete_user_content/i);
  assert.match(executionMigration,/privacy_deletion/i);
  assert.match(executionMigration,/DELETE /i);
  assert.match(executionMigration,/hercules_chat_tool_calls/i);
  assert.match(executionMigration,/hercules_chat_memories/i);
  assert.match(executionMigration,/hercules_chat_messages/i);
  assert.match(executionMigration,/hercules_chat_sessions/i);
  assert.match(executionMigration,/hercules_sessions/i);
  assert.match(executionMigration,/hercules_projects/i);
  assert.doesNotMatch(executionMigration,/delete from public\.hercules_memberships/i);
  assert.doesNotMatch(executionMigration,/delete from public\.hercules_billing/i);
});

test("privacy ops requires authenticated owner confirmation before deletion",()=>{
  assert.match(privacyOps,/owner_or_admin_required/i);
  assert.match(privacyOps,/owner_required/i);
  assert.match(privacyOps,/privacy_export/i);
  assert.match(privacyOps,/privacy_deletion_plan/i);
  assert.match(privacyOps,/privacy_delete_user_content/i);
  assert.match(privacyOps,/explicit_confirmation_required/i);
});
