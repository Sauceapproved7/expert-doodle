import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(
  new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),
  "utf8"
);
const sql=await readFile(
  new URL("../supabase/migrations/20260927061500_hercules_shopify_domain_monitor_v1.sql",import.meta.url),
  "utf8"
);
const liveDomainPatch=await readFile(
  new URL("../supabase/migrations/20260930172000_hercules_shopify_live_store_domain_v1.sql",import.meta.url),
  "utf8"
);

test("provider monitor is locked to immutable Shop GID while allowing verified store aliases",()=>{
  assert.match(edge,/gid:\/\/shopify\/Shop\/100002726208/);
  assert.match(edge,/sauceapproved-2\.myshopify\.com/);
  assert.match(edge,/azymhc-x0\.myshopify\.com/);
  assert.match(edge,/SHOP_ALIASES|shopDomainAllowed/);
  assert.ok(liveDomainPatch.includes("account_key='sauceapproved-2.myshopify.com'"));
  assert.match(edge,/shopify_production_shop_mismatch/);
});

test("scheduled internal route requires a hashed Vault-backed key",()=>{
  assert.match(edge,/shopify-domain-monitor/);
  assert.match(edge,/x-hercules-internal-key/);
  assert.match(edge,/sha256/);
  assert.match(sql,/hercules_store_secret/);
  assert.match(sql,/extensions\.digest\(v_internal_key,'sha256'\)/);
  assert.doesNotMatch(sql,/x-hercules-internal-key'\s*,\s*'[A-Za-z0-9_-]{24,}'/);
});

test("cron makes no provider call until Shopify auth and DNS readiness exist",()=>{
  assert.match(sql,/provider='shopify'/);
  assert.match(sql,/status='active'/);
  assert.match(sql,/access_secret_ref is not null/);
  assert.match(sql,/stage='shopify_attach_pending'/);
  assert.match(sql,/return null/);
});

test("monitor feeds only sanitized domain fields into the observer",()=>{
  assert.match(edge,/hercules_shopify_domain_observe/);
  assert.match(edge,/id:String\(domain\.id\|\|''\)/);
  assert.match(edge,/host:String\(domain\.host\|\|''\)\.toLowerCase\(\)/);
  assert.match(edge,/sslEnabled:Boolean\(domain\.sslEnabled\)/);
  assert.doesNotMatch(edge,/p_access_token|shopify_access_token/);
});

test("user routes remain owner/admin authenticated with custom internal auth",()=>{
  assert.match(edge,/const identity=await ownerAuth\(req\)/);
  assert.match(edge,/if\(!identity\)return j\(\{error:'owner_or_admin_required'\},403\)/);
  assert.match(edge,/internal_action_not_allowed/);
});

test("expired first-party Shopify token can be refreshed server-side",()=>{
  assert.match(edge,/Number\(\(error as any\)\?\.status\)!==401/);
  assert.match(edge,/exchangeShopifyToken/);
  assert.match(edge,/access_secret_ref:accessRef/);
  assert.doesNotMatch(edge,/return j\([^\n]*(?:access|token).*accessToken/i);
});

test("monitor cadence is bounded",()=>{
  assert.match(sql,/hercules-shopify-domain-monitor/);
  assert.match(sql,/'\*\/5 \* \* \* \*'/);
  assert.match(sql,/cron\.unschedule/);
  assert.match(sql,/cron\.schedule/);
});
