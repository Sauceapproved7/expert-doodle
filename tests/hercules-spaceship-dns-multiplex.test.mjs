import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge = await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts", import.meta.url), "utf8");
const control = await readFile(new URL("../supabase/functions/hercules-private-bridge/spaceship-dns-control.ts", import.meta.url), "utf8");
const bundledAdapter = await readFile(new URL("../supabase/functions/hercules-private-bridge/spaceship-dns.mjs", import.meta.url), "utf8");
const canonicalAdapter = await readFile(new URL("../hercules-deploy/spaceship-dns.mjs", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../supabase/migrations/20260927044500_hercules_spaceship_dns_multiplex_v1.sql", import.meta.url),
  "utf8",
);

test("private bridge preserves its existing owner/admin route while adding internal multiplex", () => {
  assert.match(bridge, /handleSpaceshipDnsRequest/);
  assert.match(bridge, /x-hercules-internal-key/);
  assert.match(bridge, /owner_or_admin_required/);
  assert.match(bridge, /hercules_private_bridge_profiles/);
  assert.match(bridge, /if\(req\.method==='POST' && req\.headers\.get\('x-hercules-internal-key'\)\)/);
});

test("multiplexed Spaceship control requires internal authentication and fixed SauceApproved domain", () => {
  assert.match(control, /internalAuthorized\(req\)/);
  assert.match(control, /const DOMAIN = "sauceapproved\.com"/);
  assert.match(control, /allowedDomains:\[DOMAIN\]/);
  assert.match(control, /custom_conflict_requires_explicit_replacement/);
  assert.doesNotMatch(control, /console\.(?:log|debug|info).*api(?:Key|Secret)/i);
});

test("private bridge carries the exact canonical DNS adapter", () => {
  assert.equal(bundledAdapter, canonicalAdapter);
});

test("SQL operator bridge targets existing private bridge function slot", () => {
  assert.match(migration, /functions\/v1\/hercules-private-bridge/);
  assert.doesNotMatch(migration, /functions\/v1\/hercules-spaceship-dns/);
  assert.match(migration, /purpose = 'spaceship-dns'/);
  assert.match(migration, /x-hercules-internal-key/);
});
