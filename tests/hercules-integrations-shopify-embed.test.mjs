import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("Hercules Integrations can render inside the installed Shopify admin app without weakening owner auth",()=>{
  assert.match(ui,/frame-ancestors https:\/\/admin\.shopify\.com https:\/\/\*\.myshopify\.com/);\n  assert.doesNotMatch(ui,/['\"]X-Frame-Options['\"]\s*:\s*['\"]DENY['\"]/);
  assert.match(ui,/async function call\(slug,body\).*Sign in required/s);
  assert.match(ui,/type="password" autocomplete="new-password" placeholder="Shopify Client Secret"/);
  assert.doesNotMatch(ui,/shopsecret[^\n]{0,200}(localStorage|sessionStorage)/);
});
