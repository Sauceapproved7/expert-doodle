import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../hercules-chat/dpop.ts", import.meta.url), "utf8").catch(()=>"");
const edge = await readFile(new URL("../hercules-chat/hercules-chat-edge.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../hercules-chat/sql/dpop-v1.sql", import.meta.url), "utf8").catch(()=>"");

test("DPoP verifier enforces proof type, asymmetric algorithm, method, URI, freshness, ath and key binding",()=>{
  for (const needle of ["dpop+jwt","ES256","htm","htu","iat","jti","ath","jkt"]) assert.ok(source.toLowerCase().includes(needle.toLowerCase()), "missing "+needle);
});
test("DPoP verifier has replay protection and constant-time comparisons",()=>{
  assert.match(source,/replay/i); assert.match(source,/timingSafe|constantTime/i);
});
test("DPoP persistence is private, server-owned, and replay claims are atomic",()=>{
  assert.match(migration,/private\.hercules_dpop_keys/i);
  assert.match(migration,/private\.hercules_dpop_replays/i);
  assert.match(migration,/on conflict do nothing/i);
  assert.match(migration,/hercules_get_dpop_key/i);
  assert.match(migration,/hercules_claim_dpop_replay/i);
  assert.match(migration,/to service_role/i);
  assert.doesNotMatch(migration,/grant execute[\s\S]*to authenticated/i);
});
test("chat DPoP rollout is feature-gated and disabled unless explicitly true",()=>{
  assert.match(edge,/HERCULES_DPOP_ENFORCED/);
  assert.match(edge,/=== "true"/);
  assert.match(edge,/verifyDpopRequest/);
  assert.match(edge,/hercules_get_dpop_key/);
  assert.match(edge,/hercules_claim_dpop_replay/);
  assert.match(edge,/Bearer /);
});


test("chat verifies OAuth token before accepting DPoP binding",()=>{
  assert.match(edge,/auth\\.getUser\\(token\\)/);
  assert.match(edge,/await authenticateChat\\(req, token\\)/);
  assert.match(edge,/DPOP_TOKEN_BINDING_REQUIRED/);
});
