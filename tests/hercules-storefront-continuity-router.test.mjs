import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(new URL("../supabase/migrations/20260927114500_hercules_storefront_continuity_router_v1.sql",import.meta.url),"utf8");
const launch=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");

test("route prefers custom domain only when active and SSL-ready",()=>{
  assert.match(sql,/create or replace function public\.hercules_storefront_route/);
  assert.match(sql,/domain_name='sauceapproved\.com'/);
  assert.match(sql,/status='active'/);
  assert.match(sql,/lower\(coalesce\(v_domain\.ssl_status,''\)\) in \('active','enabled','valid','ready'\)/);
  assert.match(sql,/shopify_current_primary_domain/);
  assert.match(sql,/myshopify\.com/);
  assert.match(sql,/mode.*fallback_myshopify/s);
  assert.match(sql,/mode.*custom_domain/s);
});

test("route never points to an arbitrary host",()=>{
  assert.match(sql,/ends_with\(lower\(v_fallback_domain\),'\.myshopify\.com'\)/);
  assert.match(sql,/v_fallback_domain := 'sauceapproved-2\.myshopify\.com'/);
  assert.doesNotMatch(sql,/http:\/\//);
});

test("Hercules launch exposes one stable storefront redirect",()=>{
  assert.match(launch,/url\.searchParams\.get\("storefront"\)==="1"/);
  assert.match(launch,/serviceRpc\("hercules_storefront_route"/);
  assert.match(launch,/Response\.redirect\(String\(route\.url\),302\)/);
  assert.match(launch,/cache-control.*no-store/i);
});

test("health advertises storefront continuity",()=>{
  assert.match(launch,/storefront_continuity:true/);
});
