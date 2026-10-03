import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260930210500_hercules_payment_authorization_bridge_v1.sql", import.meta.url),
  "utf8"
);
const provider = await readFile(
  new URL("../supabase/functions/hercules-provider-connect/index.ts", import.meta.url),
  "utf8"
);
const integrations = await readFile(
  new URL("../supabase/functions/hercules-integrations/index.ts", import.meta.url),
  "utf8"
);

test("DA-27 payment checkpoint requires legitimate live Stripe capability", () => {
  assert.match(migration,/DA-27:stripe-live-owner-auth/);
  assert.match(migration,/authorization_policy[^\n]*stripe_live_payments/i);
  assert.match(migration,/metadata->>'livemode'[^\n]*true/i);
  assert.match(migration,/metadata->>'charges_enabled'[^\n]*true/i);
  assert.match(migration,/metadata->>'payouts_enabled'[^\n]*true/i);
  assert.match(migration,/access_secret_ref is not null/i);
  assert.doesNotMatch(migration,/secret_key|password|mfa|otp/i);
});

test("Stripe provider connection records live readiness evidence", () => {
  assert.match(provider,/charges_enabled:Boolean\(account\.charges_enabled\)/);
  assert.match(provider,/payouts_enabled:Boolean\(account\.payouts_enabled\)/);
  assert.match(provider,/details_submitted:Boolean\(account\.details_submitted\)/);
  assert.match(provider,/livemode:key\.startsWith\('sk_live_'\)/);
});

test("Integrations exposes a bounded DA-27 authorization bridge", () => {
  assert.match(integrations,/data-linear-issue="DA-27"/);
  assert.match(integrations,/Payment Authorization Bridge/);
  assert.match(integrations,/Open Stripe live account/);
  assert.match(integrations,/Open Shopify Payments/);
  assert.match(integrations,/Owner authorization/);
  assert.match(integrations,/Automated after authorization/);
  assert.match(integrations,/No password, MFA code, session cookie, or banking credential is collected by this bridge/);
});
