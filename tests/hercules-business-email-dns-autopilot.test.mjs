import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927215500_hercules_business_email_dns_autopilot_v1.sql",import.meta.url),
  "utf8"
);
const mcp=await readFile(
  new URL("../supabase/functions/hercules-private-bridge/spaceship-mcp.ts",import.meta.url),
  "utf8"
);

test("business email DNS autopilot accepts either OAuth or External API authorization",()=>{
  assert.match(sql,/hercules_business_email_dns_autopilot_tick/);
  assert.match(sql,/hercules_spaceship_mcp_oauth/);
  assert.match(sql,/hercules_spaceship_dns_credentials/);
  assert.match(sql,/coalesce\(v_oauth_status,'unconfigured'\) <> 'configured'/);
  assert.match(sql,/coalesce\(v_api_status,'unconfigured'\) <> 'configured'/);
  assert.match(sql,/\band\s+coalesce\(v_api_status,'unconfigured'\) <> 'configured'/);
  assert.match(sql,/waiting_provider_authorization/);
});


test("business email migration expands DNS run actions for Resend",()=>{
  assert.match(sql,/drop constraint if exists hercules_spaceship_dns_runs_action_check/i);
  assert.match(sql,/inspect_resend_mail_dns/);
  assert.match(sql,/reconcile_resend_mail_dns/);
  assert.match(sql,/add constraint hercules_spaceship_dns_runs_action_check/i);
});

test("business email DNS autopilot calls only the fail-closed Resend reconciliation action",()=>{
  assert.match(sql,/reconcile_resend_mail_dns/);
  assert.match(sql,/hercules_spaceship_dns_submit\('reconcile_resend_mail', false\)/);
  assert.match(sql,/purpose='spaceship-dns'/);
  assert.match(sql,/hercules-private-bridge/);
  assert.doesNotMatch(sql,/replaceCustomConflicts[^\n]*true/);
});

test("business email DNS autopilot records provider verification without claiming Resend activation",()=>{
  assert.match(sql,/hercules-outbound-business-sender/);
  assert.match(sql,/dns_verified_provider_pending/);
  assert.match(sql,/"dnsReady",true|'dnsReady',true/);
  assert.match(sql,/"providerConnectionReady",false|'providerConnectionReady',false/);
});

test("autopilot RPC is service-role only",()=>{
  assert.match(sql,/revoke all on function public\.hercules_business_email_dns_autopilot_tick\(\)/i);
  assert.match(sql,/from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.hercules_business_email_dns_autopilot_tick\(\) to service_role/i);
});

test("successful Spaceship OAuth callback resumes both domain and business-email DNS autopilots",()=>{
  assert.match(mcp,/hercules_domain_launch_autopilot_tick/);
  assert.match(mcp,/hercules_business_email_dns_autopilot_tick/);
});
