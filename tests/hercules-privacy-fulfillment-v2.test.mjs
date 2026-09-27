import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927190000_hercules_privacy_fulfillment_v2.sql",import.meta.url),
  "utf8"
);
const bridge=await readFile(
  new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),
  "utf8"
);
const runbook=await readFile(
  new URL("../docs/launch/HERCULES-DATA-RIGHTS-OPERATIONS-V2.md",import.meta.url),
  "utf8"
);

test("verified access/export requests can produce a reviewed JSON package",()=>{
  assert.match(migration,/hercules_privacy_request_export/i);
  assert.match(migration,/requester_verified/i);
  assert.match(migration,/privacy_access.*privacy_export/is);
  assert.match(migration,/auth\.users/i);
  assert.match(migration,/hercules_projects/i);
  assert.match(migration,/hercules_sessions/i);
  assert.match(migration,/hercules_chat_sessions/i);
  assert.match(migration,/hercules_chat_messages/i);
  assert.match(migration,/hercules_chat_memories/i);
  assert.match(migration,/hercules_chat_tool_calls/i);
  assert.match(migration,/hercules_memberships/i);
  assert.match(migration,/hercules_usage/i);
  assert.match(migration,/hercules_billing/i);
  assert.doesNotMatch(migration,/encrypted_password|confirmation_token|recovery_token|refresh_token/i);
});

test("fulfillment RPCs stay service-role-only",()=>{
  assert.match(migration,/revoke all on function public\.hercules_privacy_request_export\(uuid\) from public, anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_privacy_request_export\(uuid\) to service_role/i);
  assert.match(migration,/revoke all on function public\.hercules_privacy_request_delete_user_scoped\(uuid,boolean\) from public, anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_privacy_request_delete_user_scoped\(uuid,boolean\) to service_role/i);
});

test("deletion executor defaults to dry-run and protects review/audit classes",()=>{
  assert.match(migration,/p_execute boolean default false/i);
  assert.match(migration,/privacy_deletion/i);
  assert.match(migration,/requester_verified/i);
  assert.match(migration,/dry_run/i);
  assert.match(migration,/delete from public\.hercules_chat_tool_calls/i);
  assert.match(migration,/delete from public\.hercules_chat_memories/i);
  assert.match(migration,/delete from public\.hercules_chat_messages/i);
  assert.match(migration,/delete from public\.hercules_chat_sessions/i);
  assert.match(migration,/delete from public\.hercules_sessions/i);
  assert.match(migration,/delete from public\.hercules_projects/i);
  assert.doesNotMatch(migration,/delete from public\.hercules_(memberships|usage|usage_events|billing|audit_log|security_events|release_)/i);
  assert.match(migration,/protected_by_default/i);
  assert.match(migration,/review_before_deletion/i);
});

test("owner bridge requires exact confirmations for export and destructive execution",()=>{
  assert.match(bridge,/privacy_request_export/);
  assert.match(bridge,/EXPORT /);
  assert.match(bridge,/privacy_request_delete_plan/);
  assert.match(bridge,/privacy_request_delete_execute/);
  assert.match(bridge,/DELETE /);
  assert.match(bridge,/owner_required/);
  assert.match(bridge,/explicit_confirmation_required/);
  assert.match(bridge,/privacy\.request\.exported/);
  assert.match(bridge,/privacy\.request\.deletion_executed/);
});

test("runbook documents reviewed fulfillment and post-delete verification",()=>{
  assert.match(runbook,/verified export/i);
  assert.match(runbook,/dry-run/i);
  assert.match(runbook,/exact owner confirmation/i);
  assert.match(runbook,/protected/i);
  assert.match(runbook,/post-deletion verification/i);
  assert.match(runbook,/does not delete.*memberships|memberships.*not automatically deleted/is);
});
