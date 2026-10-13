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


test("autopilot matches live Spaceship DNS run timestamp schema",()=>{
  const runBlock=sql.slice(sql.indexOf("hercules_spaceship_dns_runs"));
  assert.match(runBlock,/started_at/);
  assert.doesNotMatch(runBlock,/v_run\.created_at/);
});


test("status query uses each live table's own timestamp column",()=>{
  const latestRun=sql.slice(
    sql.indexOf("latest_run as ("),
    sql.indexOf("domain_row as (")
  );
  const domainRow=sql.slice(
    sql.indexOf("domain_row as ("),
    sql.indexOf("select jsonb_build_object(")
  );
  assert.match(latestRun,/order by started_at desc/);
  assert.doesNotMatch(latestRun,/order by created_at desc/);
  assert.match(domainRow,/order by created_at desc/);
  assert.doesNotMatch(domainRow,/order by started_at desc/);
});

test("tick selects started_at into the provider run record",()=>{
  const tick=sql.slice(sql.indexOf("create or replace function public.hercules_domain_launch_autopilot_tick"));
  assert.match(tick,/select trace_id,status,error,started_at,completed_at,summary/);
  assert.doesNotMatch(tick,/select trace_id,status,error,created_at,completed_at,summary/);
});


const repairedSql=await readFile(
  new URL("../supabase/migrations/20261013125000_hercules_domain_launch_autopilot_monotonic_shopify_v2.sql",import.meta.url),
  "utf8"
);

test("DA-44: verified completed Shopify cutover outranks an absent Spaceship credential",()=>{
  const observed=repairedSql.indexOf("from public.hercules_shopify_domain_cutover");
  const auth=repairedSql.indexOf("v_auth := public.hercules_spaceship_authorization_status()");
  assert.ok(observed>0 && auth>observed,"verified Shopify snapshot must be examined before registrar credentials");
  const verified=repairedSql.slice(observed,auth);
  for(const proof of [
    "v_shopify_cutover.stage = 'complete'",
    "v_shopify_cutover.current_primary_host = 'sauceapproved.com'",
    "v_shopify_cutover.current_primary_ssl_enabled is true",
    "v_shopify_cutover.intended_domain_present is true",
    "v_shopify_cutover.intended_domain_ssl_enabled is true",
    "v_shopify_cutover.last_observed_at is not null",
    "set stage='complete'",
    "'stage','complete'"
  ]) assert.ok(verified.includes(proof),"missing authoritative completion proof: "+proof);
});

test("DA-44: stale Shopify observation never returns a green readiness result",()=>{
  const observed=repairedSql.indexOf("from public.hercules_shopify_domain_cutover");
  const auth=repairedSql.indexOf("v_auth := public.hercules_spaceship_authorization_status()");
  const verified=repairedSql.slice(observed,auth);
  assert.match(verified,/last_observed_at >= v_now - interval '24 hours'/);
  assert.match(verified,/last_observed_at <= v_now \+ interval '1 minute'/);
  assert.match(verified,/'ok',v_shopify_observation_fresh/);
  assert.match(verified,/'action',case when v_shopify_observation_fresh/);
});

test("DA-44: contradictory cutover does not keep a prior complete stage eligible",()=>{
  const observed=repairedSql.indexOf("from public.hercules_shopify_domain_cutover");
  const auth=repairedSql.indexOf("v_auth := public.hercules_spaceship_authorization_status()");
  const boundary=repairedSql.slice(observed,auth);
  assert.match(boundary,/if v_state.stage='complete' then/);
  assert.match(boundary,/set stage='blocked'/);
  assert.match(boundary,/'ok',false/);
  assert.match(boundary,/shopify_cutover_no_longer_verified/);
});

test("DA-44: existing DNS authorization and privilege boundaries remain unchanged",()=>{
  assert.match(repairedSql,/v_auth := public\.hercules_spaceship_authorization_status\(\)/);
  assert.match(repairedSql,/hercules_spaceship_dns_submit\('reconcile', true\)/);
  assert.match(repairedSql,/grant execute on function public\.hercules_domain_launch_autopilot_tick\(\) to service_role/i);
  assert.match(repairedSql,/revoke all on function public\.hercules_domain_launch_autopilot_tick\(\) from public,anon,authenticated/i);
  assert.doesNotMatch(repairedSql,/\b(?:webPresenceCreate|domainCreate|primaryDomainUpdate)\b/);
});
