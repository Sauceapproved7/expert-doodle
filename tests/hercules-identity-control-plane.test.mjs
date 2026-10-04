import test from "node:test";
import assert from "node:assert/strict";
import {authorizeIdentity, compileAccessPlan, createAuthorizationEvidence, detectPolicyDrift} from "../hercules-identity/control-plane.mjs";

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

test("expired grants fail closed", () => {
  const identity = {id:"agent-1", role:"builder", active:true, expiresAt:"2026-10-03T20:00:00Z"};
  assert.deepEqual(
    authorizeIdentity(policy, identity, "build:propose", {now:"2026-10-03T21:00:00Z"}),
    {allowed:false, reason:"identity_expired"},
  );
});

test("malformed expiry fails closed instead of becoming an unlimited grant", () => {
  const identity = {id:"agent-1", role:"builder", active:true, expiresAt:"not-a-time"};
  assert.deepEqual(
    authorizeIdentity(policy, identity, "build:propose", {now:"2026-10-03T21:00:00Z"}),
    {allowed:false, reason:"identity_expiry_invalid"},
  );
});

test("access plans exclude expired or malformed grants", () => {
  const identities = [
    {id:"active", role:"builder", active:true, expiresAt:"2026-10-03T22:00:00Z"},
    {id:"expired", role:"builder", active:true, expiresAt:"2026-10-03T20:00:00Z"},
    {id:"malformed", role:"builder", active:true, expiresAt:"bad"},
  ];
  assert.deepEqual(compileAccessPlan(policy, identities, {now:"2026-10-03T21:00:00Z"}), [
    {identity:"active", role:"builder", repositories:{"expert-doodle":"write"}},
  ]);
});

test("emergency lockdown denies non-owner capabilities but preserves owner revocation", () => {
  const locked = {...policy, emergencyLockdown:true};
  assert.deepEqual(
    authorizeIdentity(locked, {id:"agent-1", role:"builder", active:true}, "build:propose"),
    {allowed:false, reason:"emergency_lockdown"},
  );
  assert.equal(authorizeIdentity(locked, {id:"owner-1", role:"owner", active:true}, "identity:revoke").allowed, true);
  assert.deepEqual(
    authorizeIdentity(locked, {id:"owner-1", role:"owner", active:true}, "release:approve"),
    {allowed:false, reason:"emergency_lockdown"},
  );
});

test("authorization evidence is deterministic for the same decision", () => {
  const identity = {id:"agent-1", role:"builder", active:true};
  const first = createAuthorizationEvidence(policy, identity, "build:propose", {now:"2026-10-03T21:00:00Z"});
  const second = createAuthorizationEvidence(policy, identity, "build:propose", {now:"2026-10-03T21:00:00Z"});
  assert.deepEqual(first, second);
  assert.equal(first.decision.allowed, true);
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
});

test("policy drift reports changed security-critical fields", () => {
  const baseline = {...policy, emergencyLockdown:false};
  const current = {...policy, emergencyLockdown:true};
  assert.deepEqual(detectPolicyDrift(baseline, current), {drifted:true, fields:["emergencyLockdown"]});
});
