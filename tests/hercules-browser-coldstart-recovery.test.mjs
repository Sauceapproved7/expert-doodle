import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const browser=await readFile(new URL("../supabase/functions/hercules-browser/index.ts",import.meta.url),"utf8");
const agent=await readFile(new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),"utf8");
const migration=await readFile(
  new URL("../supabase/migrations/20260927052000_hercules_browser_coldstart_recovery_v1.sql",import.meta.url),
  "utf8"
);

test("browser control plane performs bounded on-demand warmup instead of persistent keepalive",()=>{
  assert.match(browser,/warmupUrls/);
  assert.match(browser,/warmWorkers/);
  assert.match(browser,/AbortSignal\.timeout\(45000\)/);
  assert.match(browser,/attempts:2/);
  assert.doesNotMatch(browser,/setInterval\([^)]*fetch/i);
});

test("worker warmup URLs are controlled by the worker registry",()=>{
  assert.match(browser,/metadata\?\.warmup_urls/);
  assert.match(migration,/hercules-browser-gateway\.onrender\.com\/health/);
  assert.match(migration,/hercules-browser-api\.onrender\.com/);
  assert.match(migration,/'cold_start_recovery'/);
});

test("browser agent allows enough time for cold-start recovery",()=>{
  assert.match(agent,/version:"0\\.7\\.0"/);
  assert.match(agent,/Math\.min\(120000,Number\(request\?\.timeoutMs\|\|30000\)\+90000\)/);
  assert.match(migration,/timeout_milliseconds := 120000/);
});

test("existing safety boundaries remain intact",()=>{
  assert.match(browser,/private_target_blocked/);
  assert.match(browser,/rawCodeExecution:false/);
  assert.match(agent,/antiBotBypass:false/);
  assert.match(agent,/highImpactAutonomy:false/);
  assert.match(agent,/Do not bypass CAPTCHAs or anti-bot systems/);
});
