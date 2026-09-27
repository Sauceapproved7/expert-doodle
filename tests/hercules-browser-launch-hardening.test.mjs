import test from "node:test";
import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const routing=JSON.parse(await readFile(new URL("../governance/browser-routing-policy.json",import.meta.url),"utf8"));
const migrationNames=(await readdir(new URL("../supabase/migrations/",import.meta.url)))
  .filter(x=>x.includes("hercules_browser_runtime_monitor_v2"))
  .sort();
const migration=(await Promise.all(
  migrationNames.map(name=>readFile(new URL("../supabase/migrations/"+name,import.meta.url),"utf8"))
)).join("\n");

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

test("browser worker capacity is explicitly leased before CDP execution",()=>{
  assert.match(migration,/create table if not exists public\.hercules_browser_worker_capacity/i);
  assert.match(migration,/create table if not exists public\.hercules_browser_worker_leases/i);
  assert.match(migration,/create or replace function public\.hercules_browser_worker_lease_acquire/i);
  assert.match(migration,/values \('primary',1,75\)/i);
});

test("browser agent re-checks goal completion after each action before planning another action",async()=>{
  const agent=await readFile(new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),"utf8");
  assert.match(agent,/aiObserve\(goal,after,history\)/);
  assert.match(agent,/post_action_observation_complete/);
  assert.match(agent,/decision:"finish"[\s\S]*observationSource:"post_action"/);
});

test("browser agent deterministically completes a followed-link title goal after the click",async()=>{
  const agent=await readFile(new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),"utf8");
  assert.match(agent,/function postActionSatisfaction\(goal:string,before:any,after:any,decision:string\)/);
  assert.match(agent,/follow(?:ed|ing)?|learn more|destination/i);
  assert.match(agent,/destination_title_satisfied/);
  assert.match(agent,/const postAction=postActionSatisfaction\(goal,page,after,plan\.decision\)/);
  assert.match(agent,/if\(postAction\)/);
});

test("browser transient recovery never retries a generic interaction 502",async()=>{
  const browser=await readFile(new URL("../supabase/functions/hercules-browser/index.ts",import.meta.url),"utf8");
  const start=browser.indexOf("function transientWorkerFailure");
  const end=browser.indexOf("function delay",start);
  const block=browser.slice(start,end);
  assert.doesNotMatch(block,/worker_http_\(\?:502\|503\|504\)/);
  assert.match(block,/failed to connect to backend/);
  assert.match(block,/websocket was closed before the connection was established/);
});

test("runtime monitor distinguishes upstream transport failures from interaction failures",async()=>{
  const files=(await readdir(new URL("../supabase/migrations/",import.meta.url)))
    .filter(x=>x.includes("hercules_browser_runtime_monitor_v2"))
    .sort();
  const latest=await readFile(new URL("../supabase/migrations/"+files.at(-1),import.meta.url),"utf8");
  assert.doesNotMatch(latest,/worker_http_\(502\|503\|504\)\|429 Too Many Requests/);
  assert.match(latest,/failed to connect to backend/);
  assert.match(latest,/websocket was closed before the connection was established/);
});
