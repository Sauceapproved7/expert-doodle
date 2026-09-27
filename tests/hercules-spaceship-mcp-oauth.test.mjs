import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const mcp=await readFile(new URL("../supabase/functions/hercules-private-bridge/spaceship-mcp.ts",import.meta.url),"utf8");
const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const dns=await readFile(new URL("../supabase/functions/hercules-private-bridge/spaceship-dns-control.ts",import.meta.url),"utf8");
const oauthMigration=await readFile(new URL("../supabase/migrations/20260927102500_hercules_spaceship_mcp_oauth_v1.sql",import.meta.url),"utf8");
const bridgeMigration=await readFile(new URL("../supabase/migrations/20260927103500_hercules_spaceship_mcp_bridge_integration_v1.sql",import.meta.url),"utf8");
const publicOauthMigration=await readFile(new URL("../supabase/migrations/20260927110000_hercules_spaceship_public_oauth_v1.sql",import.meta.url),"utf8");
const handoffMigration=await readFile(new URL("../supabase/migrations/20260927111500_hercules_spaceship_auth_handoff_v1.sql",import.meta.url),"utf8");

test("Spaceship MCP OAuth uses official discovery and dynamic registration",()=>{
  assert.ok(mcp.includes('const RESOURCE_META="https://mcp.spaceship.com/.well-known/oauth-protected-resource"'));
  assert.ok(mcp.includes('const AUTH_META="https://id.service.spaceship.com/.well-known/oauth-authorization-server"'));
  assert.ok(mcp.includes('const AUTHORIZATION_ENDPOINT="https://id.service.spaceship.com/connect/authorize"'));
  assert.ok(mcp.includes('const TOKEN_ENDPOINT="https://id.service.spaceship.com/connect/token"'));
  assert.ok(mcp.includes('const REGISTRATION_ENDPOINT="https://mcp.spaceship.com/register"'));
  assert.match(mcp,/spaceship_oauth_metadata_endpoint_mismatch/);
  assert.doesNotMatch(mcp,/fetch\(url,/);
  assert.doesNotMatch(mcp,/fetch\(endpoint,/);
  assert.match(mcp,/code_challenge_method.*S256/);
  assert.match(mcp,/openid offline_access mcp\.spaceship\.com/);
  assert.match(mcp,/token_endpoint_auth_method:"none"/);
  assert.match(mcp,/client_id/);
  assert.doesNotMatch(mcp,/client_secret:clientSecret/);
});

test("Spaceship public client registration stores no client secret",()=>{
  assert.match(publicOauthMigration,/hercules_spaceship_mcp_store_public_registration/);
  assert.match(publicOauthMigration,/client_secret_secret_ref=null/);
  assert.match(publicOauthMigration,/PKCE/);
});

test("OAuth callback validates state and stores only Vault references",()=>{
  assert.match(oauthMigration,/hercules_spaceship_mcp_oauth/);
  assert.match(oauthMigration,/client_secret_secret_ref uuid/);
  assert.match(oauthMigration,/access_token_secret_ref uuid/);
  assert.match(oauthMigration,/refresh_token_secret_ref uuid/);
  assert.match(oauthMigration,/pkce_verifier_secret_ref uuid/);
  assert.match(oauthMigration,/oauth_state_sha256 text/);
  assert.match(mcp,/oauth_state_mismatch/);
  assert.match(mcp,/hercules_spaceship_mcp_complete_authorization/);
  assert.doesNotMatch(mcp,/access_token\s*:\s*accessToken/);
  assert.doesNotMatch(mcp,/refresh_token\s*:\s*refreshToken/);
  assert.doesNotMatch(mcp,/clientSecret=await secret/);
});

test("MCP transport initializes then calls DNS tools",()=>{
  assert.match(mcp,/method:"initialize"/);
  assert.match(mcp,/notifications\/initialized/);
  assert.match(mcp,/method:"tools\/call"/);
  assert.match(mcp,/dns_records_get/);
  assert.match(mcp,/dns_records_save/);
  assert.match(mcp,/dns_records_delete/);
  assert.match(mcp,/mcp-session-id/i);
  assert.match(mcp,/text\/event-stream/);
});

test("Private Bridge owns the OAuth callback and MCP action routing",()=>{
  assert.match(bridge,/handleSpaceshipMcpRequest/);
  assert.match(bridge,/isSpaceshipMcpAction/);
  assert.match(bridge,/spaceship_mcp_oauth_callback/);
  assert.match(mcp,/hercules-private-bridge\?spaceship_mcp_oauth_callback=1/);
  assert.doesNotMatch(mcp,/functions\/v1\/hercules-spaceship-mcp/);
});

test("DNS controller prefers OAuth MCP through Private Bridge and retains API-key fallback",()=>{
  assert.match(dns,/hercules_spaceship_mcp_oauth/);
  assert.match(dns,/functions\/v1\/hercules-private-bridge/);
  assert.match(dns,/spaceship_mcp_dns_records_get/);
  assert.match(dns,/spaceship_mcp_authorization_required/);
  assert.match(dns,/api_key_secret_ref/);
  assert.match(dns,/api_secret_secret_ref/);
});

test("bridge correction updates the callback and service-role OAuth launcher",()=>{
  assert.ok(bridgeMigration.includes("p_redirect_uri <> 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge?spaceship_mcp_oauth_callback=1'"));
  assert.match(bridgeMigration,/create or replace function public\.hercules_spaceship_mcp_begin/);
  assert.match(bridgeMigration,/spaceship_mcp_begin/);
});

test("domain autopilot treats either authorized lane as registrar authorization",()=>{
  assert.match(oauthMigration,/hercules_spaceship_authorization_status/);
  assert.match(oauthMigration,/oauthStatus/);
  assert.match(oauthMigration,/apiStatus/);
});

test("successful OAuth callback triggers existing launch autopilot",()=>{
  assert.match(mcp,/hercules_domain_launch_autopilot_tick/);
  assert.match(mcp,/status:"configured"/);
  assert.match(mcp,/provider:"spaceship-mcp"/);
});


test("Hercules issues expiring one-time Spaceship authorization handoffs",()=>{
  assert.match(handoffMigration,/create table if not exists public\.hercules_spaceship_auth_handoffs/);
  assert.match(handoffMigration,/token_sha256 text not null unique/);
  assert.match(handoffMigration,/expires_at timestamptz not null/);
  assert.match(handoffMigration,/status text not null default 'issued'/);
  assert.match(handoffMigration,/enable row level security/);
  assert.match(handoffMigration,/revoke all on table public\.hercules_spaceship_auth_handoffs from public, anon, authenticated/);
});

test("Private Bridge handoff route is internal-only to issue and public only with opaque token",()=>{
  assert.match(mcp,/spaceship_mcp_handoff_issue/);
  assert.match(mcp,/internal_dns_control_required/);
  assert.match(mcp,/spaceship_authorize/);
  assert.match(mcp,/handoff_token/);
  assert.match(mcp,/hercules_spaceship_auth_handoffs/);
  assert.match(mcp,/Response\.redirect/);
  assert.match(mcp,/authorization_url/);
});

test("handoff reuses an existing authorization URL and does not rotate PKCE state on repeated opens",()=>{
  assert.match(mcp,/if\(handoff\.authorization_url\)/);
  assert.match(mcp,/return Response\.redirect\(String\(handoff\.authorization_url\)/);
  const beginIndex=mcp.indexOf("const started=await beginAuthorization()");
  const reuseIndex=mcp.indexOf("if(handoff.authorization_url)");
  assert.ok(reuseIndex>=0&&beginIndex>reuseIndex);
});

test("successful Spaceship callback completes the most recent handoff and resumes autopilot",()=>{
  assert.match(mcp,/markLatestHandoffComplete/);
  assert.match(mcp,/hercules_domain_launch_autopilot_tick/);
  assert.match(mcp,/status:"configured"/);
});
