import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260928090000_hercules_owned_software_commerce_v1.sql", import.meta.url);
const studioOfferPath = new URL("../hercules-forge/offers/sauceapproved-studio/index.html", import.meta.url);
const adsOfferPath = new URL("../hercules-forge/offers/sauceapproved-ads/index.html", import.meta.url);

test("owned deployment selector fails closed to backend_autonomous targets", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /execution_mode='backend_autonomous'/);
  assert.match(sql, /autonomous=true/);
  assert.doesNotMatch(sql, /when 'assistant_managed' then 1/);
});

test("software products are product-scoped and checkout remains fail-closed", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /hercules_software_products/);
  assert.match(sql, /hercules_software_product_plans/);
  assert.match(sql, /foreign key \(product_code,plan_code\)/);
  assert.match(sql, /owner_approval_required/);
  assert.match(sql, /checkout_enabled boolean not null default false/);
  assert.match(sql, /revoke all on public\.hercules_software_access_requests from anon, authenticated/);
});

test("public access request surface exposes RPC but not protected request table", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /hercules_request_software_access/);
  assert.match(sql, /grant execute on function public\.hercules_request_software_access/);
  assert.match(sql, /request_rate_limited/);
  assert.match(sql, /p_website/);
  assert.match(sql, /private\.hercules_software_access_rate_limits/);
  assert.match(sql, /x-forwarded-for/);
  assert.match(sql, /security invoker/);
});

test("Studio and Ads offer pages expose planned tiers and live-product links", () => {
  const studio = fs.readFileSync(studioOfferPath, "utf8");
  const ads = fs.readFileSync(adsOfferPath, "utf8");
  for (const page of [studio, ads]) {
    assert.match(page, /Starter/);
    assert.match(page, /\$29/);
    assert.match(page, /Pro/);
    assert.match(page, /\$79/);
    assert.match(page, /Agency/);
    assert.match(page, /\$199/);
    assert.match(page, /Request founding access/);
    assert.match(page, /hercules_request_software_access/);
    assert.match(page, /No payment is collected/);
  }
  assert.match(studio, /sauceapproved-studio\//);
  assert.match(ads, /sauceapproved-ads\//);
});
