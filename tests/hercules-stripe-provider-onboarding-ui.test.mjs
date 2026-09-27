import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("Hercules Integrations exposes an owner-facing Stripe Direct connection card",()=>{
  assert.match(ui,/Stripe Direct/);
  assert.match(ui,/configure_stripe/);
  assert.match(ui,/stripe_secret_key/);
});

test("Stripe secret input is password masked and cleared after submission",()=>{
  assert.match(ui,/id="stripekey"[^>]*type="password"/);
  assert.match(ui,/\$\('stripekey'\)\.value=''/);
});

test("Stripe UI never renders stored secret values back to the browser",()=>{
  assert.doesNotMatch(ui,/stripe_secret_key[^\n]*textContent/);
  assert.match(ui,/webhook signing/i);
});
