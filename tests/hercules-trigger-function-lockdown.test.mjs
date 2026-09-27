import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927090500_hercules_trigger_function_lockdown_v1.sql",import.meta.url),
  "utf8"
);

test("Shopify domain readiness trigger function is not public RPC",()=>{
  assert.match(sql,/revoke all on function public\.hercules_sync_shopify_launch_readiness_from_domain\(\)[\s\S]*from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.hercules_sync_shopify_launch_readiness_from_domain\(\)[\s\S]*to service_role/i);
});

test("storefront smoke trigger function is not public RPC",()=>{
  assert.match(sql,/revoke all on function public\.hercules_sync_storefront_smoke_to_launch_readiness\(\)[\s\S]*from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.hercules_sync_storefront_smoke_to_launch_readiness\(\)[\s\S]*to service_role/i);
});

test("lockdown does not alter trigger logic or business state",()=>{
  assert.doesNotMatch(sql,/drop trigger|drop function|update public\.|delete from|insert into/i);
});
