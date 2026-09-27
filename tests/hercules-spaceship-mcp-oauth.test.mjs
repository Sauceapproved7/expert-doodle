import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(new URL("../supabase/functions/hercules-spaceship-mcp/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260927102500_hercules_spaceship_mcp_oauth_v1.sql",import.meta.url),"utf8");
const dns=await readFile(new URL("../supabase/functions/hercules-private-bridge/spaceship-dns-control.ts",import.meta.url),"utf8");
const autopilot=await readFile(new URL("../supabase/migrations/20260927102500_hercules_spaceship_mcp_oauth_v1.sql",import.meta.url),"utf8");

test("Spaceship MCP OAuth uses official discovery and dynamic registration",()=>{
  assert.match(edge,/https:\/\/mcp\.spaceship\.com\/\.well-known\/oauth-protected-resource/);
  assert.match(edge,/https:\/\/id\.service\.spaceship\.com\/\.well-known\/oauth-authorization-server/);
  assert.match(edge,/registration_endpoint/);
  assert.match(edge,/token_endpoint/);
  assert.match(edge,/authorization_endpoint/);
  assert.match(edge,/code_challenge_method.*S256/);
  assert.match(edge,/openid offline_access mcp\.spaceship\.com/);
});

test("OAuth callback validates state and stores only Vault references",()=>{
  assert.match(migration,/hercules_spaceship_mcp_oauth/);
  assert.match(migration,/client_secret_secret_ref uuid/);
  assert.match(migration,/access_token_secret_ref uuid/);
  assert.match(migration,/refresh_token_secret_ref uuid/);
  assert.match(migration,/pkce_verifier_secret_ref uuid/);
  assert.match(migration,/oauth_state_sha256 text/);
  assert.match(migration,/hercules_spaceship_mcp_store_registration/);
  assert.match(migration,/hercules_spaceship_mcp_begin_authorization/);
  assert.match(migration,/hercules_spaceship_mcp_complete_authorization/);
  assert.match(edge,/oauth_state_mismatch/);
  assert.match(edge,/hercules_spaceship_mcp_complete_authorization/);
  assert.doesNotMatch(edge,/access_token\s*:\s*accessToken/);
  assert.doesNotMatch(edge,/refresh_token\s*:\s*refreshToken/);
});

test("MCP transport initializes then calls DNS tools",()=>{
  assert.match(edge,/method:"initialize"/);
  assert.match(edge,/notifications\/initialized/);
  assert.match(edge,/method:"tools\/call"/);
  assert.match(edge,/dns_records_get/);
  assert.match(edge,/dns_records_save/);
  assert.match(edge,/dns_records_delete/);
  assert.match(edge,/mcp-session-id/i);
  assert.match(edge,/text\/event-stream/);
});

test("DNS controller prefers OAuth MCP and retains API-key fallback",()=>{
  assert.match(dns,/hercules_spaceship_mcp_oauth/);
  assert.match(dns,/hercules-spaceship-mcp/);
  assert.match(dns,/spaceship_mcp_authorization_required/);
  assert.match(dns,/api_key_secret_ref/);
  assert.match(dns,/api_secret_secret_ref/);
});

test("domain autopilot treats either authorized lane as registrar authorization",()=>{
  assert.match(autopilot,/hercules_spaceship_authorization_status/);
  assert.match(migration,/create or replace function public\.hercules_spaceship_authorization_status/);
  assert.match(migration,/oauthStatus/);
  assert.match(migration,/apiStatus/);
});

test("successful OAuth callback triggers existing launch autopilot",()=>{
  assert.match(edge,/hercules_domain_launch_autopilot_tick/);
  assert.match(edge,/status:"configured"/);
  assert.match(edge,/provider:"spaceship-mcp"/);
});
