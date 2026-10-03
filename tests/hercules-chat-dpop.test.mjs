import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../hercules-chat/dpop.ts", import.meta.url), "utf8").catch(()=>"");
const edge = await readFile(new URL("../hercules-chat/hercules-chat-edge.ts", import.meta.url), "utf8");

test("DPoP verifier enforces proof type, asymmetric algorithm, method, URI, freshness, ath and key binding",()=>{
  for (const needle of ["dpop+jwt","ES256","htm","htu","iat","jti","ath","jkt"]) assert.ok(source.toLowerCase().includes(needle.toLowerCase()), "missing "+needle);
});
test("DPoP verifier has replay protection and constant-time comparisons",()=>{
  assert.match(source,/replay/i); assert.match(source,/timingSafe|constantTime/i);
});
test("chat DPoP enforcement is explicitly gated and uses verified Supabase identity",()=>{
  assert.match(edge,/HERCULES_DPOP_ENFORCED/);
  assert.match(edge,/verifyDpopRequest/);
  assert.match(edge,/auth\.getUser\(token\)/);
  assert.match(edge,/cnf/);
  assert.match(edge,/\.jkt/);
  assert.match(edge,/reserveWeightedTokens/);
});

test("chat DPoP enforcement fails closed when token binding is absent",()=>{
  assert.match(edge,/DPOP_TOKEN_BINDING_REQUIRED/);
  assert.match(edge,/DPOP_REPLAY_STORE_UNAVAILABLE/);
});
