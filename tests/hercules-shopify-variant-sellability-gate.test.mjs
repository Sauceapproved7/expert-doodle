import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927085000_hercules_shopify_variant_sellability_gate_v1.sql",import.meta.url),
  "utf8"
);
const provider=await readFile(
  new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),
  "utf8"
);

test("launch readiness requires explicit variant sellability",()=>{
  assert.match(sql,/v_variant_sellability/);
  assert.match(sql,/sellableVariantsCount/);
  assert.match(sql,/continueSellingVariantsCount/);
  assert.match(sql,/variantSellability/);
  assert.match(sql,/and v_variant_sellability/);
});

test("every production variant must be sellable and continue-selling",()=>{
  assert.match(sql,/v_sellable_count = v_variant_count/);
  assert.match(sql,/v_continue_count = v_variant_count/);
  assert.match(sql,/v_variant_count >= 29/);
});

test("first-party Shopify readiness query retrieves variant sellability fields",()=>{
  assert.match(provider,/variants\(first:100\)/);
  assert.match(provider,/availableForSale/);
  assert.match(provider,/inventoryPolicy/);
  assert.match(provider,/sellableVariantsCount/);
  assert.match(provider,/continueSellingVariantsCount/);
});

test("zero inventory remains valid only through Shopify continue-selling policy",()=>{
  assert.doesNotMatch(sql,/inventoryQuantity/);
  assert.match(sql,/continueSellingVariantsCount/);
});

test("gate remains fixed to production anchor product and Printify vendor",()=>{
  assert.match(sql,/gid:\/\/shopify\/Product\/10258238406976/);
  assert.match(sql,/printify/);
});
