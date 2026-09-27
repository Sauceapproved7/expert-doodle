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
  assert.match(browser,/maxAttempts=5/);
  assert.doesNotMatch(browser,/setInterval\([^)]*fetch/i);
});

test("worker warmup URLs are controlled by the worker registry",()=>{
  assert.match(browser,/metadata\?\.warmup_urls/);
  assert.match(migration,/hercules-browser-gateway\.onrender\.com\/health/);
  assert.match(migration,/hercules-browser-api\.onrender\.com/);
  assert.match(migration,/'cold_start_recovery'/);
});

test("transient CDP startup failures use bounded backoff before retry",()=>{
  assert.match(browser,/function transientWorkerFailure/);
  assert.doesNotMatch(browser,/worker_http_\(\?:502\|503\|504\)/);
  assert.match(browser,/failed to connect to backend/);
  assert.match(browser,/connectOverCDP/);
  assert.match(browser,/websocket was closed before the connection was established/);
  assert.match(browser,/const retryBudgetMs=45000/);
  assert.match(browser,/await delay\(backoffMs\)/);
  assert.match(browser,/2000\*\(2\*\*\(attempt-1\)\)/);
});

test("failed worker retries are preserved in run telemetry",()=>{
  assert.match(browser,/workerAttemptsObserved/);
  assert.match(browser,/workerAttempts/);
  assert.match(browser,/attempt_count:Math\.max\(1,workerAttemptsObserved\)/);
});

test("browser agent allows enough time for cold-start recovery",()=>{
  assert.match(agent,/version:"0\.12\.0"/);
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
