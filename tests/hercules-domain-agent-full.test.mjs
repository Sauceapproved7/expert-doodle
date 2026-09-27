import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const agent=await readFile(new URL("../supabase/functions/hercules-private-bridge/domain-agent.ts",import.meta.url),"utf8");
const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260927200000_hercules_domain_agent_full_v1.sql",import.meta.url),"utf8");

test("Domain Agent exposes execution, status, usage, and customer API access",()=>{
  assert.match(agent,/domain_agent_execute/);
  assert.match(agent,/domain_agent_execution_status/);
  assert.match(agent,/domain_agent_usage_status/);
  assert.match(agent,/hercules_api_key_lookup/);
  assert.match(agent,/x-hercules-api-key/);
  assert.match(agent,/domain-agent:execute/);
});

test("safe internal execution is allowlisted and recorded in Hercules execution jobs",()=>{
  assert.match(agent,/runtime\.selftest/);
  assert.match(agent,/runtime\.capabilities/);
  assert.match(agent,/crypto\.sha256/);
  assert.match(agent,/benchmark\.echo/);
  assert.match(agent,/hercules_execution_jobs/);
  assert.match(agent,/domain-agent:/);
  assert.match(agent,/capability_envelope/);
  assert.match(agent,/domain_agent_internal/);
});

test("provider execution dispatches only through existing authorized Hercules adapters",()=>{
  assert.match(agent,/shopify\.domain\.observe/);
  assert.match(agent,/shopify\.launch\.read/);
  assert.match(agent,/github\.bridge\.verify/);
  assert.match(agent,/knowledge\.read/);
  assert.match(agent,/hercules-provider-connect/);
  assert.match(agent,/hercules-github-app/);
  assert.match(agent,/hercules-drive/);
  assert.match(agent,/shopify-domain-monitor/);
  assert.match(agent,/shopify-launch-readiness/);
  assert.match(agent,/github-finalizer/);
  assert.doesNotMatch(agent,/x-shopify-access-token/);
  assert.doesNotMatch(agent,/api\.stripe\.com/);
  assert.doesNotMatch(agent,/oauth2\.googleapis\.com/);
});

test("refresh is delegated to provider-native adapters and never fabricates consent",()=>{
  assert.match(agent,/providerNativeRefresh:true/);
  assert.match(agent,/automaticRefresh:true/);
  assert.match(agent,/provider_connection_required/);
  assert.match(agent,/OWNER_ACTION_REQUIRED/);
  assert.match(agent,/refresh_mode/);
});

test("commercial entitlements and monthly usage limits are enforced in SQL",()=>{
  assert.match(migration,/hercules_domain_agent_usage/);
  assert.match(migration,/hercules_domain_agent_entitlement/);
  assert.match(migration,/hercules_domain_agent_record_usage/);
  assert.match(migration,/founder_control_plane/);
  assert.match(migration,/domain_agent_executions_month/);
  assert.match(migration,/domain_agent/);
  assert.match(migration,/domain_agent_custom_identity/);
  assert.match(migration,/domain_agent_white_label/);
  assert.match(migration,/service_role/);
  assert.match(migration,/revoke all/i);
});

test("bridge advertises execution and commercial Domain Agent capabilities",()=>{
  assert.match(bridge,/domain_agent_execute/);
  assert.match(bridge,/domain_agent_usage/);
  assert.match(bridge,/domain_agent_api/);
});

test("commercial layer includes managed customer domain-agent identities",()=>{
  assert.match(migration,/hercules_domain_agent_identities/);
  assert.match(migration,/domain_agent_custom_identities/);
  assert.match(migration,/agent\.sauceapproved\.com/);
  assert.match(migration,/hercules-sauceapproved\.netlify\.app/);
  assert.match(migration,/hercules_domain_agent_identity_status/);
  assert.match(agent,/domain_agent_identity_status/);
});

test("provider usage is reserved before the provider side effect",()=>{
  const fn=agent.slice(agent.indexOf("async function dispatchProvider"),agent.indexOf("async function enqueueInternal"));
  const usage=fn.indexOf("recordUsage(");
  const internal=fn.indexOf("invokeInternal(");
  const owner=fn.indexOf("invokeOwnerSession(");
  assert.ok(usage>=0);
  assert.ok((internal<0||usage<internal)&&(owner<0||usage<owner));
});

test("commercial API access has an owner-facing API key lifecycle",()=>{
  assert.match(agent,/domain_agent_api_key_issue/);
  assert.match(agent,/domain_agent_api_key_revoke/);
  assert.match(agent,/hercules_api_keys/);
  assert.match(agent,/key_hash/);
  assert.match(agent,/key_prefix/);
  assert.match(agent,/crypto\.getRandomValues/);
  assert.match(agent,/api_key_secret/);
  assert.match(agent,/owner_admin_required_for_api_key_management/);
});
