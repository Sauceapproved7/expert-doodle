import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927054500_hercules_domain_launch_autopilot_v1.sql",import.meta.url),
  "utf8"
);

test("autopilot waits for legitimate Spaceship authorization",()=>{
  assert.match(sql,/waiting_authorization/);
  assert.match(sql,/hercules_spaceship_dns_credentials/);
  assert.match(sql,/credentialStatus/);
  assert.match(sql,/coalesce\(v_credential_status,'unconfigured'\) <> 'configured'/);
});

test("autopilot reuses the fail-closed Spaceship reconciliation",()=>{
  assert.match(sql,/hercules_spaceship_dns_submit\('reconcile', true\)/);
  assert.match(sql,/hercules_spaceship_dns_runs/);
  assert.match(sql,/status in \('failed','conflict'\)/);
  assert.match(sql,/stage='blocked'/);
});

test("autopilot verifies exact Shopify DNS before advancing",()=>{
  assert.match(sql,/23\.227\.38\.65/);
  assert.match(sql,/2620:0127:f00f:5::/);
  assert.match(sql,/shops\.myshopify\.com/);
  assert.match(sql,/shopify_attach_pending/);
  assert.match(sql,/dns_ready_for_shopify/);
});

test("autopilot preserves secrets server-side",()=>{
  assert.doesNotMatch(sql,/api_secret\s*=|X-API-Secret|HERCULES_SPACESHIP_API_SECRET/);
  assert.match(sql,/service_role/);
  assert.match(sql,/force row level security/i);
});

test("autopilot is bounded to one five-minute cron",()=>{
  assert.match(sql,/hercules-domain-launch-autopilot/);
  assert.match(sql,/'\*\/5 \* \* \* \*'/);
  assert.match(sql,/cron\.unschedule/);
  assert.match(sql,/cron\.schedule/);
});

test("autopilot stops before Shopify custom-domain mutation",()=>{
  assert.match(sql,/shopify_attachment_ready/);
  assert.doesNotMatch(sql,/webPresenceCreate|domainCreate|primaryDomainUpdate/);
});
