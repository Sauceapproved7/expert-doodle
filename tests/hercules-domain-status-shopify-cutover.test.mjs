import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(new URL("../supabase/functions/hercules-domains/index.ts",import.meta.url),"utf8");

test("production status includes sanitized Shopify cutover state",()=>{
  assert.match(edge,/hercules_shopify_domain_cutover/);
  assert.match(edge,/shopifyCutover:cutover\|\|null/);
  assert.match(edge,/current_primary_host/);
  assert.match(edge,/intended_domain_present/);
  assert.match(edge,/intended_domain_ssl_enabled/);
});

test("production status does not select Shopify access secrets",()=>{
  const block=edge.slice(
    edge.indexOf("async function productionStatus"),
    edge.indexOf("Deno.serve")
  );
  assert.doesNotMatch(block,/access_secret_ref|secret_ref|access_token|X-Shopify-Access-Token/i);
});

test("production status version advances",()=>{
  assert.match(edge,/version:'2\.2\.0'/);
});
