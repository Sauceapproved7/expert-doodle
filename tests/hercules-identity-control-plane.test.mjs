import test from "node:test";
import assert from "node:assert/strict";
import {authorizeIdentity, compileAccessPlan} from "../hercules-identity/control-plane.mjs";

const policy = {
  version: "1.0",
  roles: {
    owner: {repositories: {"expert-doodle": "admin"}, capabilities: ["identity:revoke", "release:approve"]},
    builder: {repositories: {"expert-doodle": "write"}, capabilities: ["build:propose"]},
    auditor: {repositories: {"expert-doodle": "read"}, capabilities: ["audit:read"]},
  },
};

test("fails closed for unknown identities and roles", () => {
  assert.deepEqual(authorizeIdentity(policy, null, "audit:read"), {allowed:false, reason:"identity_required"});
  assert.deepEqual(authorizeIdentity(policy, {id:"x", role:"missing", active:true}, "audit:read"), {allowed:false, reason:"unknown_role"});
});

test("revoked identities cannot retain capability", () => {
  assert.deepEqual(authorizeIdentity(policy, {id:"agent-1", role:"builder", active:false}, "build:propose"), {allowed:false, reason:"identity_inactive"});
});

test("capabilities are explicit rather than inherited", () => {
  assert.equal(authorizeIdentity(policy, {id:"agent-1", role:"builder", active:true}, "build:propose").allowed, true);
  assert.equal(authorizeIdentity(policy, {id:"agent-1", role:"builder", active:true}, "release:approve").allowed, false);
});

test("access plan is deterministic and excludes inactive identities", () => {
  const identities = [
    {id:"z", role:"auditor", active:true},
    {id:"a", role:"builder", active:false},
    {id:"b", role:"builder", active:true},
  ];
  assert.deepEqual(compileAccessPlan(policy, identities), [
    {identity:"b", role:"builder", repositories:{"expert-doodle":"write"}},
    {identity:"z", role:"auditor", repositories:{"expert-doodle":"read"}},
  ]);
});
