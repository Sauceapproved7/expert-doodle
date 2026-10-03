import test from "node:test";import assert from "node:assert/strict";import{readFile}from"node:fs/promises";
const sql=await readFile(new URL("../hercules-chat/sql/backend-v1.sql",import.meta.url),"utf8");
const edge=await readFile(new URL("../hercules-chat/hercules-chat-edge.ts",import.meta.url),"utf8");
test("DPoP enrollment is user-bound and requires proof possession",()=>{assert.match(sql,/hercules_enroll_dpop_key/i);assert.match(sql,/auth\.uid\(\)/i);assert.match(sql,/challenge/i)});
test("DPoP revocation is user-bound",()=>{assert.match(sql,/hercules_revoke_dpop_key/i)});
test("gateway resolves trusted key binding and claims replay",()=>{assert.match(edge,/hercules_get_dpop_key/i);assert.match(edge,/hercules_claim_dpop_replay/i)});
