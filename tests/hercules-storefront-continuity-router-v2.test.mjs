import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(new URL("../supabase/migrations/20261003153000_hercules_storefront_continuity_router_v2.sql",import.meta.url),"utf8");
const launch=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");

test("storefront route fails closed to the canonical Shopify store until the custom domain is verified",()=>{
  assert.match(sql,/hercules_storefront_route/);
  assert.match(sql,/sauceapproved-2\.myshopify\.com/);
  assert.match(sql,/sauceapproved\.com/);
  assert.match(sql,/status='active'/);
  assert.match(sql,/ssl_status/);
  assert.match(sql,/dns_ready_for_shopify/);
  assert.match(sql,/revoke all on function public\.hercules_storefront_route\(\) from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.hercules_storefront_route\(\) to service_role/i);
});

test("launch exposes a no-store redirect resolved only by the service-role router",()=>{
  assert.match(launch,/searchParams\.get\(["']storefront["']\).*===["']1["']/);
  assert.match(launch,/hercules_storefront_route/);
  assert.match(launch,/Response\.redirect/);
  assert.match(launch,/cache-control.*no-store/i);
});
