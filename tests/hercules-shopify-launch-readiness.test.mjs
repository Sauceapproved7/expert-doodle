import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927063000_hercules_shopify_launch_readiness_v1.sql",import.meta.url),
  "utf8"
);
const liveDomainPatch=await readFile(
  new URL("../supabase/migrations/20260930172000_hercules_shopify_live_store_domain_v1.sql",import.meta.url),
  "utf8"
);

test("readiness is pinned to the verified production shop and anchor product",()=>{
  assert.match(sql,/gid:\/\/shopify\/Shop\/100002726208/);
  assert.match(sql,/gid:\/\/shopify\/Product\/10258238406976/);
  assert.match(sql,/shopify_launch_shop_gid_mismatch/);
});

test("readiness gates theme product channels collections menus and domain separately",()=>{
  for(const gate of [
    "paidPlan","mainTheme","anchorProduct","onlineStorePublication","shopPublication",
    "launchDropCollection","hoodiesCollection","apparelCollection","mainMenu","footerMenu",
    "domainComplete","storefrontReady"
  ]) assert.match(sql,new RegExp(gate));
  assert.match(sql,/ready_except_domain/);
  assert.match(sql,/blocked_storefront/);
});

test("Printify zero tracked inventory is not treated as a launch failure",()=>{
  assert.match(sql,/lower\(coalesce\(p_snapshot#>>'\{product,vendor\}'/);
  assert.doesNotMatch(sql,/totalInventory/);
});

test("domain completion requires SauceApproved primary plus SSL-enabled cutover state",()=>{
  assert.match(sql,/stage='complete'/);
  assert.match(sql,/intended_domain_present/);
  assert.match(sql,/intended_domain_ssl_enabled/);
  assert.match(sql,/current_primary_host/);
  assert.match(sql,/sauceapproved\.com/);
});

test("readiness monitor credentials are Vault-backed and service-role only",()=>{
  assert.match(sql,/purpose='shopify-launch-readiness'/);
  assert.match(sql,/hercules_store_secret/);
  assert.match(sql,/hercules_get_secret/);
  assert.match(sql,/force row level security/i);
  assert.doesNotMatch(sql,/x-hercules-internal-key'\s*,\s*'[A-Za-z0-9_-]{24,}'/);
});

test("monitor cadence is bounded to fifteen minutes and idle without first-party Shopify auth",()=>{
  assert.match(sql,/'\*\/15 \* \* \* \*'/);
  assert.match(sql,/provider='shopify'/);
  assert.match(sql,/access_secret_ref is not null/);
  assert.match(sql,/return null/);
});


test("scheduled readiness submitter targets the live SauceApproved Shopify account key",()=>{
  assert.match(liveDomainPatch,/hercules_shopify_launch_readiness_submit/);
  assert.match(liveDomainPatch,/account_key='sauceapproved-2\.myshopify\.com'/);
  assert.doesNotMatch(liveDomainPatch,/account_key='azymhc-x0\.myshopify\.com'/);
});
