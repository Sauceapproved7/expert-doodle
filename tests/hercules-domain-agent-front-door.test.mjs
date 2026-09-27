import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const proxy=await readFile(new URL("../netlify/edge-functions/domain-agent-proxy.ts",import.meta.url),"utf8");

test("domain-agent edge proxy routes only the intended public agent surfaces",()=>{
  assert.match(proxy,/\.well-known\/hercules-agent\.json/);
  assert.match(proxy,/\/health/);
  assert.match(proxy,/\/v1\/\*/);
  assert.match(proxy,/hercules-private-bridge/);
});

test("domain-agent edge proxy strips internal-control credentials",()=>{
  assert.match(proxy,/delete\(['"]x-hercules-internal-key['"]\)/);
  assert.match(proxy,/cache-control/);
  assert.match(proxy,/no-store/);
  assert.doesNotMatch(proxy,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role/i);
});

test("proxy preserves owner and tenant authentication rather than inventing authorization",()=>{
  assert.doesNotMatch(proxy,/authorization.*Bearer.*[^r]/i);
  assert.match(proxy,/new Headers\(req\.headers\)/);
});
