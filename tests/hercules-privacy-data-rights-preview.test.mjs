import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927183500_hercules_privacy_data_rights_preview_v1.sql",import.meta.url),
  "utf8"
);
const bridge=await readFile(
  new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),
  "utf8"
);
const runbook=await readFile(
  new URL("../docs/launch/HERCULES-DATA-RIGHTS-OPERATIONS-V1.md",import.meta.url),
  "utf8"
);

test("data-rights preview is service-role-only and fail-closed",()=>{
  assert.match(migration,/hercules_privacy_request_preview/i);
  assert.match(migration,/security definer/i);
  assert.match(migration,/requester_verified\s*<>\s*true|not\s+v_request\.requester_verified/i);
  assert.match(migration,/auth\.users/i);
  assert.match(migration,/revoke all on function public\.hercules_privacy_request_preview\(uuid\) from public, anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_privacy_request_preview\(uuid\) to service_role/i);
  assert.doesNotMatch(migration,/delete\s+from/i);
  assert.doesNotMatch(migration,/update\s+public\.hercules_(projects|sessions|chat_)/i);
});

test("preview distinguishes deletable/review/protected classes",()=>{
  assert.match(migration,/user_scoped_content/i);
  assert.match(migration,/review_before_deletion/i);
  assert.match(migration,/protected_by_default/i);
  assert.match(migration,/hercules_audit_log/i);
  assert.match(migration,/hercules_security_events/i);
  assert.match(migration,/hercules_release_/i);
  assert.match(migration,/executable.*false/is);
});

test("owner bridge keeps the preview handler non-destructive",()=>{
  assert.match(bridge,/privacy_request_list/);
  assert.match(bridge,/privacy_request_verify/);
  assert.match(bridge,/privacy_request_preview/);
  assert.match(bridge,/VERIFY /);
  assert.match(bridge,/verification_method/);
  assert.match(bridge,/hercules_privacy_request_preview/);
  const start=bridge.indexOf("if(action==='privacy_request_preview')");
  const end=bridge.indexOf("if(action==='privacy_export')",start);
  assert.ok(start>=0&&end>start);
  const previewHandler=bridge.slice(start,end);
  assert.doesNotMatch(previewHandler,/delete\s+from|\.delete\(|privacy_request_delete|execute_deletion/i);
  assert.doesNotMatch(previewHandler,/\.update\(/i);
});

test("runbook keeps irreversible deletion behind a later approval",()=>{
  assert.match(runbook,/preview-only/i);
  assert.match(runbook,/does not delete/i);
  assert.match(runbook,/explicit owner approval/i);
  assert.match(runbook,/audit/i);
  assert.match(runbook,/security/i);
});
