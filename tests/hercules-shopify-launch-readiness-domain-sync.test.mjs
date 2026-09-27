import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927064000_hercules_shopify_launch_readiness_domain_sync_v1.sql",import.meta.url),
  "utf8"
);

test("domain sync requires complete cutover, presence, SSL and exact primary host",()=>{
  assert.match(sql,/new\.stage='complete'/);
  assert.match(sql,/new\.intended_domain_present/);
  assert.match(sql,/new\.intended_domain_ssl_enabled/);
  assert.match(sql,/current_primary_host/);
  assert.match(sql,/sauceapproved\.com/);
});

test("domain sync preserves storefront gates and only updates domain completion plus stage",()=>{
  assert.match(sql,/gates->>'storefrontReady'/);
  assert.match(sql,/jsonb_set/);
  assert.match(sql,/\{domainComplete\}/);
  assert.match(sql,/ready_except_domain/);
  assert.match(sql,/blocked_storefront/);
});

test("domain sync is event driven by cutover changes",()=>{
  assert.match(sql,/create trigger hercules_shopify_launch_readiness_domain_sync/);
  assert.match(sql,/after insert or update of/);
  assert.match(sql,/hercules_shopify_domain_cutover/);
});

test("domain sync does not require or expose Shopify credentials",()=>{
  assert.doesNotMatch(sql,/access_secret|client_secret|x-shopify|token/i);
});
