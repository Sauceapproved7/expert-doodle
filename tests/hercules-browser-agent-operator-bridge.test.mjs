import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927050500_hercules_browser_agent_operator_bridge_v1.sql",import.meta.url),
  "utf8"
);
const agent=await readFile(
  new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),
  "utf8"
);

test("browser agent operator bridge is service-role only",()=>{
  assert.match(migration,/revoke all on function public\.hercules_browser_agent_submit\([\s\S]*from public, anon, authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_browser_agent_submit\([\s\S]*to service_role/i);
  assert.match(migration,/revoke all on function public\.hercules_browser_agent_result\(bigint\)[\s\S]*from public, anon, authenticated/i);
});

test("bridge retrieves browser-agent key from Vault instead of embedding it",()=>{
  assert.match(migration,/purpose = 'browser-agent'/);
  assert.match(migration,/hercules_get_secret/);
  assert.match(migration,/x-hercules-internal-key/);
  assert.doesNotMatch(migration,/x-hercules-internal-key'\s*,\s*'[A-Za-z0-9_-]{24,}'/);
});

test("bridge enforces bounded URL, domains, inputs, and max steps",()=>{
  assert.match(migration,/browser_agent_valid_http_url_required/);
  assert.match(migration,/browser_agent_too_many_allowed_domains/);
  assert.match(migration,/browser_agent_inputs_invalid/);
  assert.match(migration,/p_max_steps < 1 or p_max_steps > 6/);
});

test("canonical browser agent remains bounded and blocks high-impact autonomous actions",()=>{
  assert.match(agent,/bounded_goal_driven/);
  assert.match(agent,/antiBotBypass:false/);
  assert.match(agent,/highImpactAutonomy:false/);
  assert.match(agent,/Do not bypass CAPTCHAs or anti-bot systems/);
  assert.match(agent,/Do not make purchases, transfers, trades, account deletions, security-setting changes/);
  assert.match(agent,/allowedDomains/);
});
