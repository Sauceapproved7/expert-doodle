import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20260928120000_hercules_cleaner_software_catalog_v1.sql", import.meta.url);
const offerPath = new URL("../hercules-forge/offers/hercules-cleaner/index.html", import.meta.url);
const bridge = await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts", import.meta.url), "utf8");
const provider = await readFile(new URL("../supabase/functions/hercules-provider-connect/index.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../supabase/functions/hercules-integrations/index.ts", import.meta.url), "utf8");

test("Cleaner catalog migration registers the product and three owner-gated plans", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /'hercules-cleaner','Hercules Cleaner','Recoverable Computer Maintenance','early_access'/);
  assert.match(sql, /'hercules-cleaner','starter','Starter',2900,'owner_approval_required',false/);
  assert.match(sql, /'hercules-cleaner','pro','Pro',7900,'owner_approval_required',false/);
  assert.match(sql, /'hercules-cleaner','agency','Agency',19900,'owner_approval_required',false/);
  assert.match(sql, /checkout_enabled=false/);
  assert.match(sql, /canonical_core/);
  assert.match(sql, /local_agent_with_web_commerce/);
});

test("Cleaner offer page is access-request only and explains local-first recovery controls", async () => {
  const html = await readFile(offerPath, "utf8");
  assert.match(html, /Hercules Cleaner/);
  assert.match(html, /Session Clean/);
  assert.match(html, /Recovery Capsules/);
  assert.match(html, /local-first/i);
  assert.match(html, /Request Early Access/);
  assert.match(html, /hercules_request_software_access/);
  assert.match(html, /PRODUCT="hercules-cleaner"/);
  assert.match(html, /No payment is collected/i);
  assert.doesNotMatch(html, /checkout_session|create-checkout|payment_intent/i);
});

test("commercial owner controls and provider readiness include Cleaner without auto-enabling checkout", () => {
  assert.match(bridge, /sauceapproved-studio','sauceapproved-ads','hercules-cleaner/);
  assert.match(provider, /sauceapproved-studio','sauceapproved-ads','hercules-cleaner/);
  assert.match(ui, /'hercules-cleaner':'Hercules Cleaner'/);
  assert.doesNotMatch(provider, /hercules-cleaner[^\n]+payment_path_verified[^\n]+true/);
});

test("Cleaner catalog preparation does not infer owner pricing or legal approval", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /'hercules-cleaner'[^;]+pricing_status='approved'/s);
  assert.doesNotMatch(sql, /'hercules-cleaner'[^;]+checkout_enabled=true/s);
  assert.match(sql, /owner_approval_required/);
});
