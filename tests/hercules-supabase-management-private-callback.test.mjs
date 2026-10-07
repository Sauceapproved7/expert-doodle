import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const callback=await readFile(new URL("../supabase/functions/hercules-private-bridge/supabase-management-oauth.ts",import.meta.url),"utf8");
const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");

test("private bridge owns Supabase Management OAuth callback routing",()=>{
  assert.match(bridge,/handleSupabaseManagementOAuthRequest/);
  assert.match(bridge,/supabase_management_oauth_callback/);
  assert.match(callback,/https:\/\/api\.supabase\.com\/v1\/oauth\/authorize/);
  assert.match(callback,/https:\/\/api\.supabase\.com\/v1\/oauth\/token/);
});

test("authorization start uses PKCE and Vault-backed state RPC",()=>{
  assert.match(callback,/code_challenge_method","S256"/);
  assert.match(callback,/hercules_supabase_management_begin_authorization/);
  assert.match(callback,/hercules_get_secret/);
  assert.doesNotMatch(callback,/scope=/);
});

test("callback validates state through Vault custody and stores token references",()=>{
  assert.match(callback,/hercules_supabase_management_complete_authorization/);
  assert.match(callback,/code_verifier/);
  assert.match(callback,/grant_type","authorization_code"/);
  assert.match(callback,/Basic /);
  assert.doesNotMatch(callback,/accessToken:/);
  assert.doesNotMatch(callback,/refreshToken:/);
});

test("configured authority immediately enables only Hercules OAuth server settings",()=>{
  assert.match(callback,/xbwuablxhhwsaoomsoco/);
  assert.match(callback,/oauth_server_enabled/);
  assert.match(callback,/oauth_server_allow_dynamic_registration/);
  assert.match(callback,/oauth_server_authorization_path/);
  assert.match(callback,/\/oauth\/consent/);
  assert.match(callback,/config\/auth/);
});

test("Management OAuth start remains owner-only and credential-free",()=>{
  assert.match(callback,/owner_required/);
  assert.match(callback,/secretExposure:false/);
  assert.match(callback,/supabase_management_oauth_start/);
});


test("callback validates OAuth state before exchanging the one-time authorization code",()=>{
  assert.match(callback,/hercules_supabase_management_validate_callback_state/);
  const preflight=callback.indexOf("hercules_supabase_management_validate_callback_state");
  const exchange=callback.indexOf("tokenRequest(");
  assert.ok(preflight>=0,"state preflight RPC must exist");
  assert.ok(exchange>=0,"token exchange must exist");
  assert.ok(preflight<exchange,"state preflight must happen before token exchange");
});
