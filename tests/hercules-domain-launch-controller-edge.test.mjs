import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(new URL("../supabase/functions/hercules-domains/index.ts",import.meta.url),"utf8");
const analyzer=await readFile(new URL("../supabase/functions/hercules-domains/domain-launch.mjs",import.meta.url),"utf8");

test("production status is read-only and fixed to SauceApproved",()=>{
  assert.match(edge,/action==='production_status'/);
  assert.match(edge,/SAUCEAPPROVED_DOMAIN/);
  assert.match(edge,/productionStatus\(db,org\)/);
  assert.match(analyzer,/sauceapproved\.com/);
});

test("DNS reconciliation requires owner or admin and explicit domain confirmation",()=>{
  const block=edge.slice(edge.indexOf("if(action==='production_reconcile')"),edge.indexOf("if(action==='production_reconcile_result')"));
  assert.match(block,/\['owner','admin'\]\.includes\(r\)/);
  assert.match(block,/confirm_domain/);
  assert.match(block,/spaceship_credentials_unconfigured/);
  assert.match(block,/primary_target_type!=='shopify_store'/);
});

test("DNS reconciliation uses the existing fail-closed Spaceship control plane",()=>{
  assert.match(edge,/hercules_spaceship_dns_submit/);
  assert.match(edge,/p_action:'reconcile'/);
  assert.match(edge,/p_replace_custom_conflicts:true/);
  assert.match(edge,/domain\.production_reconcile\.queued/);
});

test("public status checks A, AAAA, CNAME, NS and HTTPS",()=>{
  assert.match(edge,/resolveDnsSafe\(d\.domain_name,'A'\)/);
  assert.match(edge,/resolveDnsSafe\(d\.domain_name,'AAAA'\)/);
  assert.match(edge,/resolveDnsSafe\('www\.'\+d\.domain_name,'CNAME'\)/);
  assert.match(edge,/resolveDnsSafe\(d\.domain_name,'NS'\)/);
  assert.match(edge,/method:'HEAD'/);
});

test("launch analyzer requires exact Shopify web-routing records",()=>{
  assert.match(analyzer,/23\.227\.38\.65/);
  assert.match(analyzer,/2620:0127:f00f:5::/);
  assert.match(analyzer,/shops\.myshopify\.com/);
  assert.match(analyzer,/A\.length===1/);
  assert.match(analyzer,/AAAA\.length===1/);
  assert.match(analyzer,/CNAME\.length===1/);
});
