import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Spaceship connection uses the SauceApproved Shopify DNS contract", async () => {
  const source = await readFile("supabase/functions/hercules-spaceship-connect/index.ts", "utf8");
  assert.match(source, /sauceapproved\.com/);
  assert.match(source, /azymhc-x0\.myshopify\.com/);
  assert.match(source, /23\.227\.38\.65/);
  assert.match(source, /2620:0127:f00f:5::/);
  assert.match(source, /shops\.myshopify\.com/);
  assert.match(source, /dnsrecords:read/);
  assert.match(source, /dnsrecords:write/);
  assert.match(source, /provider_managed_dns_conflict/);
  assert.match(source, /replace_custom_conflicts/);
});

test("Spaceship provider is registered in the provider connection constraint", async () => {
  const sql = await readFile("supabase/migrations/20260927043000_add_spaceship_provider.sql", "utf8");
  assert.match(sql, /hercules_provider_connections_provider_check/);
  assert.match(sql, /spaceship/);
});
