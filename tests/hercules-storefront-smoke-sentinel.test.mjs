import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927083500_hercules_storefront_smoke_sentinel_v1.sql",import.meta.url),
  "utf8"
);

test("smoke sentinel uses the owned Browser Agent with a read-only goal",()=>{
  assert.match(sql,/hercules_browser_agent_submit/);
  assert.match(sql,/hercules-storefront-smoke/);
  assert.match(sql,/Do not add anything to cart and do not change state/);
});

test("smoke sentinel only targets the production Shopify or verified custom domain",()=>{
  assert.match(sql,/sauceapproved-2\\\.myshopify\\\.com/);
  assert.match(sql,/sauceapproved\\\.com/);
  assert.match(sql,/products\/sauceapproved-premium-hoodie/);
  assert.match(sql,/stage='complete'/);
  assert.match(sql,/intended_domain_ssl_enabled/);
});

test("smoke sentinel avoids overlapping recent browser runs",()=>{
  assert.match(sql,/status='running'/);
  assert.match(sql,/created_at > now\(\) - interval '10 minutes'/);
  assert.match(sql,/return null/);
});

test("healthy requires fresh success and all storefront observations",()=>{
  assert.match(sql,/status='succeeded'/);
  assert.match(sql,/completed_at >= now\(\)-interval '2 hours'/);
  assert.match(sql,/Publicly reachable: yes/);
  assert.match(sql,/SauceApproved hoodie visible: yes/);
  assert.match(sql,/Size\/color variant controls visible: yes/);
  assert.match(sql,/Add-to-cart or purchase control visible: yes/);
});

test("smoke sentinel runs hourly at minute 17",()=>{
  assert.match(sql,/hercules-storefront-smoke/);
  assert.match(sql,/'17 \* \* \* \*'/);
  assert.match(sql,/cron\.schedule/);
  assert.match(sql,/cron\.unschedule/);
});

test("smoke sentinel stores no credentials",()=>{
  assert.doesNotMatch(sql,/access_secret|client_secret|api_secret|x-hercules-internal-key/i);
});
