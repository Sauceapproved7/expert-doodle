import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927060000_hercules_shopify_domain_cutover_observer_v1.sql",import.meta.url),
  "utf8"
);

test("observer is fixed to the verified production Shopify shop",()=>{
  assert.match(sql,/gid:\/\/shopify\/Shop\/100002726208/);
  assert.match(sql,/shopify_shop_gid_mismatch/);
  assert.match(sql,/sauceapproved\.com/);
});

test("observer stages attachment SSL primary and completion separately",()=>{
  for(const stage of ["waiting_dns","awaiting_attachment","awaiting_ssl","ready_for_primary","complete","blocked"]){
    assert.match(sql,new RegExp(stage));
  }
  assert.match(sql,/v_intended_present and v_intended_ssl/);
  assert.match(sql,/p_primary_host/);
});

test("observer requires a bounded sanitized domain array",()=>{
  assert.match(sql,/jsonb_typeof\(p_domains\) <> 'array'/);
  assert.match(sql,/v_domain_count < 1 or v_domain_count > 50/);
  assert.match(sql,/shopify_domain_item_invalid/);
  assert.doesNotMatch(sql,/X-Shopify-Access-Token|SHOPIFY_ACCESS_TOKEN|access_token/i);
});

test("completion requires custom domain present SSL enabled and primary",()=>{
  assert.match(sql,/lower\(trim\(p_primary_host\)\)='sauceapproved\.com'/);
  assert.match(sql,/not v_intended_present or not v_intended_ssl or p_primary_ssl_enabled is not true/);
  assert.match(sql,/shopify_custom_domain_primary/);
  assert.match(sql,/stage='complete'/);
});

test("observer is service-role only",()=>{
  assert.match(sql,/revoke all on function public\.hercules_shopify_domain_observe[\s\S]*from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.hercules_shopify_domain_observe[\s\S]*to service_role/i);
  assert.match(sql,/force row level security/i);
});
