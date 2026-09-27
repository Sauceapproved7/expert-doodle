import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(
  new URL("../supabase/functions/hercules-domains/index.ts",import.meta.url),
  "utf8"
);

test("production domain status includes sanitized Shopify cutover state",()=>{
  assert.match(edge,/hercules_shopify_domain_cutover/);
  assert.match(edge,/shopifyCutover:cutover\|\|null/);
  assert.match(edge,/current_primary_host/);
  assert.match(edge,/intended_domain_present/);
  assert.match(edge,/intended_domain_ssl_enabled/);
});

test("production domain status includes launch readiness gates",()=>{
  assert.match(edge,/hercules_shopify_launch_readiness/);
  assert.match(edge,/launchReadiness:readiness\|\|null/);
  assert.match(edge,/stage,gates,source,last_error,last_observed_at,last_transition_at,storefront_status,storefront_verified_at,storefront_verification,updated_at/);
});

test("production status does not select Shopify secrets",()=>{
  const start=edge.indexOf("async function productionStatus");
  const end=edge.indexOf("Deno.serve",start);
  const block=edge.slice(start,end);
  assert.doesNotMatch(block,/access_secret_ref|secret_ref|client_secret|access_token|X-Shopify/i);
});

test("production status version advances",()=>{
  assert.match(edge,/version:'2\.4\.0'/);
});
