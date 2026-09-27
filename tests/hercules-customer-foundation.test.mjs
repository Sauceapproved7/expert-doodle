import test from "node:test";
import assert from "node:assert/strict";
import {createCustomerContext,evaluateCustomerAction,verifyCustomerContext} from "../hercules-runtime/customer-foundation.mjs";

const base=()=>({
 user:{id:"user-1"},
 workspace:{id:"ws-1"},
 membership:{role:"owner",evidenceSha256:"a".repeat(64)},
 identity:{evidenceSha256:"b".repeat(64)},
 plan:{id:"growth",features:["chat","forge","recovery"],monthlyActionLimit:100},
 usage:{monthlyActions:10}
});

test("customer context is deterministic and integrity bound",()=>{const a=createCustomerContext(base()),b=createCustomerContext({...base(),plan:{id:"growth",features:["recovery","forge","chat"],monthlyActionLimit:100}});assert.equal(a.contextSha256,b.contextSha256);assert.equal(verifyCustomerContext(a).valid,true)});
test("cross-workspace requests fail closed",()=>{const c=createCustomerContext(base());const r=evaluateCustomerAction(c,{workspaceId:"ws-2",feature:"forge",action:"build"});assert.equal(r.disposition,"DENY");assert.ok(r.reasonCodes.includes("WORKSPACE_MISMATCH"))});
test("role boundary is enforced",()=>{const i=base();i.membership.role="viewer";const r=evaluateCustomerAction(createCustomerContext(i),{workspaceId:"ws-1",feature:"forge",action:"build"});assert.equal(r.disposition,"DENY");assert.ok(r.reasonCodes.includes("ROLE_INSUFFICIENT"))});
test("plan feature is enforced",()=>{const c=createCustomerContext(base());const r=evaluateCustomerAction(c,{workspaceId:"ws-1",feature:"video",action:"read"});assert.equal(r.disposition,"DENY");assert.ok(r.reasonCodes.includes("FEATURE_NOT_ENTITLED"))});
test("monthly action limit fails closed",()=>{const i=base();i.usage.monthlyActions=100;const r=evaluateCustomerAction(createCustomerContext(i),{workspaceId:"ws-1",feature:"forge",action:"build"});assert.equal(r.disposition,"DENY");assert.ok(r.reasonCodes.includes("USAGE_LIMIT_REACHED"))});
test("owner within plan and usage boundary can proceed to later gates",()=>{const c=createCustomerContext(base());const r=evaluateCustomerAction(c,{workspaceId:"ws-1",feature:"recovery",action:"publish"});assert.equal(r.disposition,"CUSTOMER_BOUNDARY_SATISFIED");assert.equal(r.executionAuthority,false)});
test("tampering is detected",()=>{const c=createCustomerContext(base());c.workspace.id="other";assert.equal(verifyCustomerContext(c).valid,false)});
