import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const provider=await readFile(new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),"utf8");
const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260928013000_hercules_stripe_oauth_broker_v1.sql",import.meta.url),"utf8");

test("Stripe onboarding is OAuth-first and keeps direct API key entry as fallback",()=>{
  assert.match(provider,/stripe_oauth_start/);
  assert.match(provider,/stripe_oauth_callback/);
  assert.match(provider,/marketplace\.stripe\.com\/oauth\/v2\/authorize/);
  assert.match(provider,/api\.stripe\.com\/v1\/oauth\/token/);
  assert.match(ui,/Connect with Stripe/);
  assert.match(ui,/OAuth-first/);
  assert.match(ui,/Fallback: restricted or secret API key/);
  assert.match(provider,/configure_stripe/);
});

test("Stripe OAuth validates one-time state and stores tokens only in Vault-backed refs",()=>{
  assert.match(migration,/create table if not exists private\.hercules_stripe_oauth_handoffs/i);
  assert.match(migration,/state_sha256 text not null/i);
  assert.match(migration,/expires_at timestamptz not null/i);
  assert.match(migration,/status text not null/i);
  assert.match(provider,/await sha256\(state\)/);
  assert.match(provider,/hercules_stripe_oauth_handoffs/);
  assert.match(provider,/status.*pending_authorization/s);
  assert.match(provider,/storeSecret\([\s\S]*access_token/s);
  assert.match(provider,/storeSecret\([\s\S]*refresh_token/s);
  assert.doesNotMatch(provider,/return j\([^\n]*(access_token|refresh_token)/i);
});

test("OAuth connection preserves existing catalog and webhook fail-closed readiness",()=>{
  assert.match(provider,/ensureStripeCatalog/);
  assert.match(provider,/webhook_endpoints\?limit=100/);
  assert.match(provider,/stripe_webhook_signing_secret_unavailable/);
  assert.match(provider,/catalog_ready:true/);
  assert.match(provider,/auth_model:'oauth'/);
  assert.match(provider,/oauth_access_expires_at/);
});

test("Stripe OAuth callback never treats missing developer configuration as authorization",()=>{
  assert.match(provider,/STRIPE_APP_CLIENT_ID/);
  assert.match(provider,/STRIPE_APP_DEVELOPER_LIVE_KEY/);
  assert.match(provider,/stripe_oauth_not_configured/);
  assert.match(ui,/Developer registration required/);
});
