import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("Hercules Integrations can render inside the installed Shopify admin app without weakening owner auth",()=>{
  assert.match(ui,/frame-ancestors https:\/\/admin\.shopify\.com https:\/\/\*\.myshopify\.com/);
  assert.doesNotMatch(ui,/['\"]X-Frame-Options['\"]\s*:\s*['\"]DENY['\"]/);
  assert.match(ui,/async function call\(slug,body\).*Sign in required/s);
  assert.match(ui,/type="password" autocomplete="new-password" placeholder="Shopify Client Secret"/);
  assert.match(ui,/<meta name="shopify-api-key" content="1ed12710f0b797a7a3328c1cf4e8b1f9">/);
  assert.match(ui,/<script src="https:\/\/cdn\.shopify\.com\/shopifycloud\/app-bridge\.js"><\/script>/);
  assert.match(ui,/script-src[^;]*https:\/\/cdn\.shopify\.com/);
  assert.doesNotMatch(ui,/shopsecret[^\n]{0,200}(localStorage|sessionStorage)/);
});
