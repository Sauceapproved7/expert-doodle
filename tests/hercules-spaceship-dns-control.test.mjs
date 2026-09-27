import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge = await readFile(new URL("../supabase/functions/hercules-spaceship-dns/index.ts", import.meta.url), "utf8");
const edgeAdapter = await readFile(new URL("../supabase/functions/hercules-spaceship-dns/spaceship-dns.mjs", import.meta.url), "utf8");
const canonicalAdapter = await readFile(new URL("../hercules-deploy/spaceship-dns.mjs", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../supabase/migrations/20260927043000_hercules_spaceship_dns_control_v1.sql", import.meta.url),
  "utf8",
);

test("Edge bundle is locked to the canonical Spaceship DNS adapter", () => {
  assert.equal(edgeAdapter, canonicalAdapter);
});

test("Edge control surface is fixed to SauceApproved and never exposes raw credentials", () => {
  assert.match(edge, /const DOMAIN = "sauceapproved\.com"/);
  assert.match(edge, /allowedDomains:\[DOMAIN\]/);
  assert.match(edge, /inspect_shopify_dns/);
  assert.match(edge, /reconcile_shopify_dns/);
  assert.match(edge, /replaceCustomConflicts/);
  assert.match(edge, /rawCredentialExposure:false/);
  assert.doesNotMatch(edge, /console\.(?:log|debug|info).*api(?:Key|Secret)/i);
  assert.doesNotMatch(edge, /return json\([^\n]*(?:apiKey|apiSecret)/i);
});

test("credential registry stores only Vault references", () => {
  assert.match(migration, /api_key_secret_ref uuid/);
  assert.match(migration, /api_secret_secret_ref uuid/);
  assert.match(migration, /hercules_store_secret/);
  assert.match(migration, /vault\.update_secret/);
  assert.match(migration, /force row level security/i);
  assert.doesNotMatch(migration, /api_key\s+text\s*,/i);
  assert.doesNotMatch(migration, /api_secret\s+text\s*,/i);
});

test("credential provisioning and operator bridge are service-role only", () => {
  assert.match(migration, /revoke all on function public\.hercules_spaceship_dns_configure_credentials\(text,text\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.hercules_spaceship_dns_configure_credentials\(text,text\)[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function public\.hercules_spaceship_dns_submit\(text,boolean\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.hercules_spaceship_dns_submit\(text,boolean\)[\s\S]*to service_role/i);
});

test("internal Edge authentication is generated and kept in Vault", () => {
  assert.match(migration, /purpose = 'spaceship-dns'/);
  assert.match(migration, /extensions\.gen_random_bytes\(32\)/);
  assert.match(migration, /extensions\.digest\(v_internal_key, 'sha256'\)/);
  assert.match(migration, /hercules_store_secret/);
  assert.doesNotMatch(migration, /'spaceship-dns'\s*,\s*'[a-f0-9]{32,}'/i);
});

test("reconcile requires explicit custom-conflict replacement", () => {
  assert.match(edge, /custom_conflict_requires_explicit_replacement/);
  assert.match(edge, /preflight\.blockingConflicts\.length/);
  assert.match(edge, /replaceCustomConflicts\}/);
});
