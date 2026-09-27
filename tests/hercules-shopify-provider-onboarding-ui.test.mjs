import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(
  new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),
  "utf8"
);

test("Integrations exposes first-party Shopify onboarding",()=>{
  assert.match(ui,/Shopify Direct/);
  assert.match(ui,/gid:\/\/shopify\/Shop\/100002726208/);
  assert.match(ui,/configure_shopify/);
  assert.match(ui,/shopify_domain_status/);
});

test("Shopify secret fields are password-masked and cleared",()=>{
  assert.match(ui,/id="shopsecret"[^>]*type="password"/);
  assert.match(ui,/\$\('shopsecret'\)\.value=''/);
  assert.match(ui,/\$\('shopclient'\)\.value=''/);
});

test("Shopify credential values are not embedded in source",()=>{
  assert.doesNotMatch(ui,/shpat_[A-Za-z0-9]/);
  assert.doesNotMatch(ui,/SHOPIFY_ACCESS_TOKEN/);
  assert.doesNotMatch(ui,/X-Shopify-Access-Token/);
});
