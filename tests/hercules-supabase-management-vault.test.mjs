import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(new URL("../supabase/migrations/20261007003500_hercules_supabase_management_oauth_v1.sql",import.meta.url),"utf8");

test("Supabase Management OAuth state stores only Vault references and hashed state",()=>{
  assert.match(migration,/create table if not exists public\.hercules_supabase_management_oauth/);
  assert.match(migration,/client_secret_secret_ref uuid/);
  assert.match(migration,/access_token_secret_ref uuid/);
  assert.match(migration,/refresh_token_secret_ref uuid/);
  assert.match(migration,/pkce_verifier_secret_ref uuid/);
  assert.match(migration,/oauth_state_sha256 text/);
  assert.doesNotMatch(migration,/client_secret text/);
  assert.doesNotMatch(migration,/access_token text/);
  assert.doesNotMatch(migration,/refresh_token text/);
});

test("Supabase Management OAuth custody is service-role only and RLS forced",()=>{
  assert.match(migration,/enable row level security/);
  assert.match(migration,/force row level security/);
  assert.match(migration,/revoke all on table public\.hercules_supabase_management_oauth from public, anon, authenticated/);
  assert.match(migration,/grant select, insert, update on table public\.hercules_supabase_management_oauth to service_role/);
});

test("authorization state is hashed, PKCE is vaulted, and callback state expires",()=>{
  assert.match(migration,/hercules_supabase_management_begin_authorization/);
  assert.match(migration,/hercules_store_secret/);
  assert.match(migration,/extensions\.digest\(p_state,'sha256'\)/);
  assert.match(migration,/interval '20 minutes'/);
  assert.match(migration,/oauth_state_mismatch/);
});

test("completed and refreshed tokens rotate inside Vault",()=>{
  assert.match(migration,/hercules_supabase_management_complete_authorization/);
  assert.match(migration,/hercules_supabase_management_refresh_tokens/);
  assert.match(migration,/vault\.update_secret/);
  assert.match(migration,/status='configured'/);
});

test("Management authority is pinned to Hercules project and auth write purpose",()=>{
  assert.match(migration,/xbwuablxhhwsaoomsoco/);
  assert.match(migration,/auth:write/);
  assert.match(migration,/supabase-management-auth/);
});
