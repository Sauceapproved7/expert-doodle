import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927075500_hercules_shopify_storefront_verification_evidence_v1.sql",import.meta.url),
  "utf8"
);
const edge=await readFile(
  new URL("../supabase/functions/hercules-domains/index.ts",import.meta.url),
  "utf8"
);

test("storefront evidence has explicit verified failed and unverified states",()=>{
  assert.match(sql,/storefront_status text not null default 'unverified'/);
  assert.match(sql,/unverified','verified','failed/);
  assert.match(sql,/storefront_verified_at/);
  assert.match(sql,/storefront_verification jsonb/);
});

test("verification requires a canonical Browser Agent run id and bounded title",()=>{
  assert.match(sql,/browser-agent-\[0-9a-f-\]\{36\}/);
  assert.match(sql,/storefront_verification_run_id_invalid/);
  assert.match(sql,/length\(p_page_title\) > 500/);
});

test("verification only passes when product variants and purchase control are all visible",()=>{
  assert.match(sql,/p_product_visible/);
  assert.match(sql,/p_variants_visible/);
  assert.match(sql,/p_purchase_control_visible/);
  assert.match(sql,/v_status := case when v_verified then 'verified' else 'failed' end/);
});

test("evidence stores no browser secrets or session tokens",()=>{
  assert.doesNotMatch(sql,/internal-key|secret|token|sessionId|cookie/i);
});

test("record function is service-role only",()=>{
  assert.match(sql,/revoke all on function public\.hercules_shopify_storefront_verification_record[\s\S]*from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.hercules_shopify_storefront_verification_record[\s\S]*to service_role/i);
});

test("production domain status exposes storefront verification evidence",()=>{
  assert.match(edge,/storefront_status,storefront_verified_at,storefront_verification/);
  assert.match(edge,/version:'2\.4\.0'/);
});
