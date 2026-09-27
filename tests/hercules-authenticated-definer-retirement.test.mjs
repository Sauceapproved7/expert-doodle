import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927092000_hercules_authenticated_definer_retirement_v1.sql",import.meta.url),
  "utf8"
);
const launch=await readFile(
  new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),
  "utf8"
);
const chat=await readFile(
  new URL("../hercules-chat/hercules-chat-edge.ts",import.meta.url),
  "utf8"
);

test("legacy authenticated SECURITY DEFINER RPC execution is revoked",()=>{
  assert.match(migration,/revoke all on function public\.hercules_bootstrap_organization\(text,text\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration,/revoke all on function public\.hercules_chat_current_usage\(\)[\s\S]*from public, anon, authenticated/i);
});

test("new privileged helpers are service-role only",()=>{
  assert.match(migration,/hercules_bootstrap_organization_internal\(uuid,text,text\)[\s\S]*to service_role/i);
  assert.match(migration,/hercules_chat_current_usage_internal\(uuid\)[\s\S]*to service_role/i);
  assert.match(migration,/security definer/i);
});

test("organization bootstrap preserves launch and owner protections",()=>{
  assert.match(migration,/email confirmation required/);
  assert.match(migration,/public registration is not open/);
  assert.match(migration,/public-registration-open/);
  assert.match(migration,/hercules_launch_gate_checks/);
  assert.match(migration,/hercules-onboard-%@example\.com/);
  assert.match(migration,/reserved organization slug/);
  assert.match(migration,/hercules_pending_domain_claims/);
});

test("launch Edge route authenticates user before service-role bootstrap",()=>{
  assert.match(launch,/\/auth\/v1\/user/);
  assert.match(launch,/authenticated_user_required/);
  assert.match(launch,/hercules_bootstrap_organization_internal/);
  assert.match(launch,/p_user_id:user\.id/);
  assert.doesNotMatch(launch,/sb\.rpc\("hercules_bootstrap_organization"/);
});

test("launch browser client uses authenticated Edge action instead of privileged RPC",()=>{
  assert.match(launch,/fetchFn\("hercules-launch",\{method:"POST"/);
  assert.match(launch,/action:"bootstrap_organization"/);
  assert.match(launch,/organization_id/);
});

test("chat usage runs only through JWT-gated Edge with service-role internal RPC",()=>{
  assert.match(chat,/const userId = decodeJwtSub\(req\)/);
  assert.match(chat,/rpc\/hercules_chat_current_usage_internal/);
  assert.match(chat,/p_user_id: userId/);
  const usage=chat.slice(chat.indexOf('if (action === "usage")'),chat.indexOf('if (action === "run_chat")'));
  assert.match(usage,/true,/);
  assert.doesNotMatch(usage,/"rpc\/hercules_chat_current_usage"/);
});

test("internal usage query is explicitly scoped to supplied authenticated user id",()=>{
  assert.match(migration,/select p_user_id as uid/);
  assert.match(migration,/l\.user_id=target\.uid/);
  assert.match(migration,/b\.user_id=target\.uid/);
  assert.match(migration,/u\.user_id=target\.uid/);
});
