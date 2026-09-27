import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(new URL("../supabase/functions/hercules-launch-onboarding-e2e/index.ts",import.meta.url),"utf8");

test("synthetic onboarding uses the service-role bootstrap helper retired from authenticated RPC",()=>{
  assert.match(edge,/admin\.rpc\("hercules_bootstrap_organization_internal"/);
  assert.match(edge,/p_user_id:uid/);
  assert.doesNotMatch(edge,/client\.rpc\("hercules_bootstrap_organization"/);
});

test("synthetic onboarding still uses short-lived one-time nonce authorization",()=>{
  assert.match(edge,/hercules_forge_e2e_nonces/);
  assert.match(edge,/used_at/);
  assert.match(edge,/expires_at/);
});
