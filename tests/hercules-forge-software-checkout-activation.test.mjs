import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260928093000_hercules_software_checkout_activation_v1.sql", import.meta.url);
const termsPath = new URL("../docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md", import.meta.url);
const privacyPath = new URL("../docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md", import.meta.url);

test("software checkout activation is product-scoped and fail-closed", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /hercules_software_commercial_approvals/);
  assert.match(sql, /primary key \(product_code,approval_type\)/);
  assert.match(sql, /pricing.*terms.*privacy/s);
  assert.match(sql, /payment_provider_ready/);
  assert.match(sql, /payment_path_verified/);
  assert.match(sql, /checkout_enabled=false/);
  assert.match(sql, /hercules_software_checkout_readiness/);
  assert.match(sql, /hercules_activate_software_checkout/);
});

test("activation cannot cross product price catalogs", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /sauceapproved-studio/);
  assert.match(sql, /sauceapproved-ads/);
  assert.match(sql, /2900/);
  assert.match(sql, /7900/);
  assert.match(sql, /19900/);
  assert.doesNotMatch(sql, /4900/);
  assert.doesNotMatch(sql, /14900/);
  assert.doesNotMatch(sql, /39900/);
});

test("software legal candidates are specific to Studio and Ads and remain owner-pending", () => {
  const terms = fs.readFileSync(termsPath, "utf8");
  const privacy = fs.readFileSync(privacyPath, "utf8");
  for (const doc of [terms, privacy]) {
    assert.match(doc, /SauceApproved Studio/);
    assert.match(doc, /SauceApproved Ads/);
    assert.match(doc, /SauceApproved enterprise LLC/);
    assert.match(doc, /owner/i);
    assert.match(doc, /not effective/i);
  }
  assert.match(terms, /Starter.*\$29/s);
  assert.match(terms, /Pro.*\$79/s);
  assert.match(terms, /Agency.*\$199/s);
  assert.match(privacy, /Stripe/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Render/);
});
