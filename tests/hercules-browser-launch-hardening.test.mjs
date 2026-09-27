import test from "node:test";
import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const routing=JSON.parse(await readFile(new URL("../governance/browser-routing-policy.json",import.meta.url),"utf8"));
const migrationName=(await readdir(new URL("../supabase/migrations/",import.meta.url)))
  .filter(x=>x.endsWith("_hercules_browser_runtime_monitor_v2.sql"))
  .sort()
  .at(-1);
const migration=migrationName
  ? await readFile(new URL("../supabase/migrations/"+migrationName,import.meta.url),"utf8")
  : "";

test("Hercules Browser remains the default owned browser route",()=>{
  assert.equal(routing.defaultBrowser,"hercules-browser");
  assert.equal(routing.ownedControlSurface,"hercules-browser");
  assert.equal(routing.personalSessionBrowser?.automaticFallback,false);
});

test("personal authenticated browser handoff never exports credentials or cookies",()=>{
  assert.equal(routing.personalSessionBrowser?.mode,"explicit-owner-session-only");
  assert.equal(routing.personalSessionBrowser?.passwordExport,false);
  assert.equal(routing.personalSessionBrowser?.cookieExport,false);
  assert.equal(routing.personalSessionBrowser?.credentialExport,false);
  assert.equal(routing.personalSessionBrowser?.humanVerificationBypass,false);
});

test("browser runtime monitor actively probes the real browser execution path",()=>{
  assert.match(migration,/create or replace function public\.hercules_browser_health_probe_submit\(\)/i);
  assert.match(migration,/public\.hercules_browser_submit\(/i);
  assert.match(migration,/https:\/\/example\.com\/\?hercules-health-probe=1/i);
  assert.match(migration,/cron\.schedule\([\s\S]*hercules-browser-health-probe/i);
});

test("browser runtime monitor detects upstream retries latency and stale runs",()=>{
  assert.match(migration,/worker_http_\(502\|503\|504\)/i);
  assert.match(migration,/attempt_count\s*>?=\s*3/i);
  assert.match(migration,/percentile_cont\(0\.95\)/i);
  assert.match(migration,/stale_runtime_timeout/i);
  assert.match(migration,/hercules-browser-runtime/i);
});

test("browser runtime monitor records and resolves incidents",()=>{
  assert.match(migration,/insert into public\.hercules_service_health_checks/i);
  assert.match(migration,/insert into public\.hercules_service_incidents/i);
  assert.match(migration,/status='resolved'/i);
});

test("browser monitor functions are service-role only",()=>{
  assert.match(migration,/revoke all on function public\.hercules_browser_health_probe_submit\(\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration,/revoke all on function public\.hercules_browser_runtime_monitor\(\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_browser_runtime_monitor\(\)[\s\S]*to service_role/i);
});
