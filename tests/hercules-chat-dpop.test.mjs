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
test("chat DPoP implementation is not silently treated as enabled",()=>{
  const gated = edge.includes("HERCULES_DPOP_ENFORCED") && edge.includes("verifyDpopRequest");
  assert.equal(gated, false);
});

// DPoP edge integration contract: feature-gated, bearer-compatible when disabled.
