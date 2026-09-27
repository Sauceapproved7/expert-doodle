import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927181500_hercules_domain_agent_registry_v1.sql",import.meta.url),
  "utf8"
);
const edge=await readFile(
  new URL("../supabase/functions/hercules-domain-agent/index.ts",import.meta.url),
  "utf8"
);

test("domain-agent policy registry is private, RLS-enabled, and credential-free",()=>{
  assert.match(migration,/create table if not exists private\.hercules_domain_agent_provider_policies/i);
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all on table private\.hercules_domain_agent_provider_policies from public, anon, authenticated/i);
  assert.doesNotMatch(migration,/password|refresh_token\s+text|access_token\s+text|client_secret\s+text/i);
});

test("grant resolver is service-role only and reads existing provider state without decrypting secrets",()=>{
  assert.match(migration,/create or replace function public\.hercules_domain_agent_resolve_provider_grant/i);
  assert.match(migration,/security definer/i);
  assert.match(migration,/set search_path\s*=\s*''/i);
  assert.match(migration,/from public\.hercules_provider_connections/i);
  assert.match(migration,/access_secret_ref is not null/i);
  assert.match(migration,/secret_ref is not null/i);
  assert.match(migration,/signing_secret_ref is not null/i);
  assert.doesNotMatch(migration,/hercules_get_secret/i);
  assert.match(migration,/revoke all on function public\.hercules_domain_agent_resolve_provider_grant[\s\S]*from public, anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_domain_agent_resolve_provider_grant[\s\S]*to service_role/i);
});

test("grant resolver emits deterministic SHA-256 evidence and checks required capabilities",()=>{
  assert.match(migration,/extensions\.digest/i);
  assert.match(migration,/authorization_evidence_sha256/i);
  assert.match(migration,/required_capabilities/i);
  assert.match(migration,/missing_capabilities/i);
  assert.match(migration,/carries_credentials[^\n]*false/i);
  assert.match(migration,/credential_custody[^\n]*supabase_vault/i);
});

test("provider defaults are conservative and provider-specific",()=>{
  assert.match(migration,/'google_drive'[\s\S]*knowledge\.read/i);
  assert.match(migration,/'github_forge'[\s\S]*github\.bridge\.verify/i);
  assert.match(migration,/'shopify'[\s\S]*shopify\.domain\.observe/i);
  assert.match(migration,/'stripe'[\s\S]*stripe\.account\.read/i);
});

test("edge function publishes discovery without exposing provider state",()=>{
  assert.match(edge,/hercules\.domain-agent\.discovery\.v1/);
  assert.match(edge,/agent\.sauceapproved\.com/);
  assert.match(edge,/\.well-known\/hercules-agent\.json/);
  assert.match(edge,/service:'hercules-domain-agent'/);
  assert.doesNotMatch(edge,/hercules_get_secret/);
});

test("edge function protects task preflight with owner-admin or internal authentication",()=>{
  assert.match(edge,/ownerOrAdmin/i);
  assert.match(edge,/internalAuthorized/i);
  assert.match(edge,/domain-agent-control/);
  assert.match(edge,/x-hercules-internal-key/i);
  assert.match(edge,/hercules_domain_agent_resolve_provider_grant/i);
  assert.match(edge,/required_capabilities/i);
});

test("edge function fails closed on owner-only boundaries before grant resolution",()=>{
  assert.match(edge,/OWNER_ONLY/i);
  assert.match(edge,/required_permission_grants/);
  assert.match(edge,/private_credentials_or_2fa/);
  assert.match(edge,/legally_binding_consent/);
  assert.match(edge,/owner_action_required/);
});

test("edge function bounds bodies and sends no-store security headers",()=>{
  assert.match(edge,/MAX_BODY_BYTES/);
  assert.match(edge,/request_body_too_large/);
  assert.match(edge,/'cache-control':'no-store'/i);
  assert.match(edge,/'x-content-type-options':'nosniff'/i);
});
