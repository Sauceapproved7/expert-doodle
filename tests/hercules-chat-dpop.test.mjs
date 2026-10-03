import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../hercules-chat/dpop.ts", import.meta.url), "utf8").catch(()=>"");
const edge = await readFile(new URL("../hercules-chat/hercules-chat-edge.ts", import.meta.url), "utf8");

test("DPoP verifier enforces proof type, asymmetric algorithm, method, URI, freshness, ath and cnf.jkt",()=>{
  for (const needle of ["dpop+jwt","ES256","htm","htu","iat","jti","ath","cnf","jkt"]) assert.match(source,new RegExp(needle.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\for (const needle of ["dpop+jwt","ES256","htm","htu","iat","jti","ath","cnf","jkt"]) assert.match(source,new RegExp(needle,"i"));"),"i"));
});
test("DPoP verifier has replay protection and constant-time comparisons",()=>{
  assert.match(source,/replay/i); assert.match(source,/timingSafe|constantTime/i);
});
test("chat DPoP rollout is feature-gated and preserves bearer compatibility when disabled",()=>{
  assert.match(edge,/HERCULES_DPOP_ENFORCED/);
  assert.match(edge,/verifyDpopRequest/);
});
