import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),"utf8");

test("Stripe onboarding derives products and prices from the active Hercules plan catalog",()=>{
  assert.match(edge,/from\('hercules_plans'\)[\s\S]*select\('code,name,monthly_price_cents,annual_price_cents,is_active'\)[\s\S]*eq\('is_active',true\)/);
  assert.match(edge,/ensureStripeCatalog/);
});

test("Stripe catalog uses stable Hercules plan metadata and lookup keys",()=>{
  assert.match(edge,/metadata\[hercules_plan_code\]/);
  assert.match(edge,/hercules_\$\{plan\.code\}_monthly_v1/);
  assert.match(edge,/hercules_\$\{plan\.code\}_annual_v1/);
  assert.match(edge,/recurring\[interval\]/);
  assert.match(edge,/recurring\[interval_count\]/);
  assert.match(edge,/lookup_keys\[\]/);
});

test("Stripe connection is not marked active until canonical catalog sync succeeds",()=>{
  const block=edge.slice(edge.indexOf("if(action==='configure_stripe')"));
  assert.match(block,/const catalog=await ensureStripeCatalog\(admin,key\)/);
  assert.ok(block.indexOf("const catalog=await ensureStripeCatalog(admin,key)") < block.indexOf("upsertConnection(admin,org,'stripe'"));
  assert.match(block,/catalog_ready:true/);
  assert.match(block,/catalog/);
});

test("Stripe catalog automation does not delete or deactivate unrelated Stripe objects",()=>{
  assert.doesNotMatch(edge,/api\.stripe\.com\/v1\/(products|prices)\/[^'\`]+[\s\S]{0,180}method:'DELETE'/);
  assert.doesNotMatch(edge,/active=false/);
});
