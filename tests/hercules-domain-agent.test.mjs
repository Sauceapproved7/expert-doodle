import test from "node:test";
import assert from "node:assert/strict";
import {createAuthorityLease} from "../hercules-authority/authority-lease.mjs";
import {
  createDomainAgentIdentity,
  createProviderGrantRecord,
  createAgentDiscoveryDocument,
  evaluateDomainAgentTask,
} from "../hercules-authority/domain-agent.mjs";

const SHA = "a".repeat(64);
const NOW = "2026-09-27T18:00:00.000Z";

function identity() {
  return createDomainAgentIdentity({
    domain: "agent.sauceapproved.com",
    tenantId: "sauceapproved",
    agentId: "hercules-domain-agent",
  });
}

function grant(overrides = {}) {
  return createProviderGrantRecord({
    tenantId: "sauceapproved",
    provider: "github",
    connectionRef: "github-connection-primary",
    authorizationEvidenceSha256: SHA,
    scopes: ["repo.read", "repo.write"],
    status: "active",
    refreshable: true,
    authorizedAt: "2026-09-27T16:00:00Z",
    expiresAt: "2026-09-27T20:00:00Z",
    ...overrides,
  });
}

function lease() {
  return createAuthorityLease({
    subject: {type: "domain-agent", id: "hercules-domain-agent"},
    intent: {id: "task-1"},
    authorization: {evidenceSha256: SHA},
    scope: {
      resources: ["github:repo:Sauceapproved7/expert-doodle"],
      actions: ["repository.update"],
      maxImpact: "RESOURCE",
    },
    validFrom: "2026-09-27T17:00:00Z",
    expiresAt: "2026-09-27T19:00:00Z",
  });
}

function request(overrides = {}) {
  return {
    id: "task-1",
    tenantId: "sauceapproved",
    provider: "github",
    requiredScopes: ["repo.write"],
    resource: "github:repo:Sauceapproved7/expert-doodle",
    action: "repository.update",
    impact: "RESOURCE",
    at: NOW,
    ...overrides,
  };
}

test("domain identity turns an owned domain into a stable Hercules agent identity", () => {
  const value = identity();
  assert.equal(value.schema, "hercules.domain-agent.identity.v1");
  assert.equal(value.origin, "https://agent.sauceapproved.com");
  assert.equal(value.subject, "https://agent.sauceapproved.com/agents/hercules-domain-agent");
  assert.equal(value.discoveryUrl, "https://agent.sauceapproved.com/.well-known/hercules-agent.json");
  assert.equal(value.executionAuthority, false);
});

test("discovery advertises automation without claiming authorization bypass", () => {
  const doc = createAgentDiscoveryDocument(identity());
  assert.equal(doc.schema, "hercules.domain-agent.discovery.v1");
  assert.equal(doc.capabilities.providerGrantReuse, true);
  assert.equal(doc.capabilities.automaticRefresh, true);
  assert.equal(doc.capabilities.multiTenantIsolation, true);
  assert.equal(doc.security.bypassAuthorization, false);
  assert.equal(doc.security.bypass2FA, false);
  assert.equal(doc.security.rawCredentialsAccepted, false);
});

test("provider grant records persist references and evidence but never credentials", () => {
  const value = grant();
  assert.equal(value.connectionRef, "github-connection-primary");
  assert.equal(value.authorizationEvidenceSha256, SHA);
  assert.equal(value.carriesCredentials, false);
  assert.deepEqual(value.scopes, ["repo.read", "repo.write"]);
});

test("provider grant records reject credential material recursively", () => {
  assert.throws(
    () => createProviderGrantRecord({
      tenantId: "sauceapproved",
      provider: "github",
      connectionRef: "x",
      authorizationEvidenceSha256: SHA,
      scopes: ["repo.read"],
      status: "active",
      refreshable: true,
      authorizedAt: "2026-09-27T16:00:00Z",
      expiresAt: "2026-09-27T20:00:00Z",
      nested: {accessToken: "should-never-be-here"},
    }),
    /credential material/i,
  );
});

test("active matching grant and authority lease make a task execution-eligible", () => {
  const decision = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant(),
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(decision.disposition, "EXECUTE");
  assert.equal(decision.executionEligible, true);
  assert.equal(decision.requiresOwnerInteraction, false);
  assert.equal(decision.executionAuthority, false);
  assert.match(decision.decisionSha256, /^[a-f0-9]{64}$/);
});

test("expired refreshable grants route to automatic refresh", () => {
  const decision = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant({expiresAt: "2026-09-27T17:59:59Z"}),
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(decision.disposition, "REFRESH_REQUIRED");
  assert.equal(decision.executionEligible, false);
  assert.equal(decision.requiresOwnerInteraction, false);
});

test("missing provider consent stops exactly at the owner-only boundary", () => {
  const decision = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: null,
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(decision.disposition, "OWNER_ACTION_REQUIRED");
  assert.equal(decision.requiresOwnerInteraction, true);
  assert.ok(decision.reasonCodes.includes("PROVIDER_CONNECTION_REQUIRED"));
});

test("revoked or insufficient grants fail closed and require renewed consent", () => {
  const revoked = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant({status: "revoked"}),
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(revoked.disposition, "OWNER_ACTION_REQUIRED");
  assert.ok(revoked.reasonCodes.includes("PROVIDER_GRANT_REVOKED"));

  const insufficient = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant({scopes: ["repo.read"]}),
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(insufficient.disposition, "OWNER_ACTION_REQUIRED");
  assert.ok(insufficient.reasonCodes.includes("PROVIDER_SCOPE_GRANT_REQUIRED"));
});

test("explicit owner-only operations can never be silently automated", () => {
  const decision = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant(),
    authorityLease: lease(),
    request: request({ownerBoundary: "legally_binding_consent"}),
  });
  assert.equal(decision.disposition, "OWNER_ACTION_REQUIRED");
  assert.ok(decision.reasonCodes.includes("OWNER_ONLY_BOUNDARY"));
});

test("tenant crossover and lease violations fail closed", () => {
  const tenantMismatch = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant({tenantId: "other-tenant"}),
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(tenantMismatch.disposition, "DENY");
  assert.ok(tenantMismatch.reasonCodes.includes("TENANT_MISMATCH"));

  const leaseDenied = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant(),
    authorityLease: lease(),
    request: request({action: "repository.delete"}),
  });
  assert.equal(leaseDenied.disposition, "DENY");
  assert.ok(leaseDenied.reasonCodes.includes("AUTHORITY_LEASE_DENIED"));
});

test("equivalent evaluations produce the same audit decision fingerprint", () => {
  const first = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant(),
    authorityLease: lease(),
    request: request(),
  });
  const second = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant({scopes: ["repo.write", "repo.read"]}),
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(first.decisionSha256, second.decisionSha256);
});

test("lease subject, task intent, and provider authorization evidence are cryptographically bound", () => {
  const wrongSubject = createAuthorityLease({
    subject: {type: "domain-agent", id: "other-agent"},
    intent: {id: "task-1"},
    authorization: {evidenceSha256: SHA},
    scope: {resources: ["github:repo:Sauceapproved7/expert-doodle"], actions: ["repository.update"], maxImpact: "RESOURCE"},
    validFrom: "2026-09-27T17:00:00Z",
    expiresAt: "2026-09-27T19:00:00Z",
  });
  const subjectDecision = evaluateDomainAgentTask({
    identity: identity(), providerGrant: grant(), authorityLease: wrongSubject, request: request(),
  });
  assert.equal(subjectDecision.disposition, "DENY");
  assert.ok(subjectDecision.reasonCodes.includes("AGENT_IDENTITY_MISMATCH"));

  const wrongIntent = createAuthorityLease({
    subject: {type: "domain-agent", id: "hercules-domain-agent"},
    intent: {id: "other-task"},
    authorization: {evidenceSha256: SHA},
    scope: {resources: ["github:repo:Sauceapproved7/expert-doodle"], actions: ["repository.update"], maxImpact: "RESOURCE"},
    validFrom: "2026-09-27T17:00:00Z",
    expiresAt: "2026-09-27T19:00:00Z",
  });
  const intentDecision = evaluateDomainAgentTask({
    identity: identity(), providerGrant: grant(), authorityLease: wrongIntent, request: request(),
  });
  assert.equal(intentDecision.disposition, "DENY");
  assert.ok(intentDecision.reasonCodes.includes("INTENT_MISMATCH"));

  const evidenceDecision = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant({authorizationEvidenceSha256: "c".repeat(64)}),
    authorityLease: lease(),
    request: request(),
  });
  assert.equal(evidenceDecision.disposition, "DENY");
  assert.ok(evidenceDecision.reasonCodes.includes("AUTHORIZATION_EVIDENCE_MISMATCH"));
});

test("domain identity only accepts a hostname and always publishes an HTTPS origin", () => {
  assert.throws(
    () => createDomainAgentIdentity({domain: "http://agent.sauceapproved.com", tenantId: "x", agentId: "y"}),
    /hostname/i,
  );
  assert.throws(
    () => createDomainAgentIdentity({domain: "localhost", tenantId: "x", agentId: "y"}),
    /public domain/i,
  );
});


test("task grant pinning rejects permission drift before execution", () => {
  const currentGrant = grant();
  const pinned = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: currentGrant,
    authorityLease: lease(),
    request: request({expectedGrantSha256: currentGrant.grantSha256}),
  });
  assert.equal(pinned.disposition, "EXECUTE");
  assert.equal(pinned.executionEligible, true);

  const changedGrant = grant({scopes: ["repo.read", "repo.write", "repo.admin"]});
  const drifted = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: changedGrant,
    authorityLease: lease(),
    request: request({expectedGrantSha256: currentGrant.grantSha256}),
  });
  assert.equal(drifted.disposition, "DENY");
  assert.equal(drifted.executionEligible, false);
  assert.ok(drifted.reasonCodes.includes("PROVIDER_GRANT_PIN_MISMATCH"));
});

test("task validity windows reject premature and stale instructions", () => {
  const premature = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant(),
    authorityLease: lease(),
    request: request({notBefore: "2026-09-27T18:05:00Z"}),
  });
  assert.equal(premature.disposition, "DENY");
  assert.ok(premature.reasonCodes.includes("TASK_NOT_YET_VALID"));

  const stale = evaluateDomainAgentTask({
    identity: identity(),
    providerGrant: grant(),
    authorityLease: lease(),
    request: request({expiresAt: "2026-09-27T17:59:59Z"}),
  });
  assert.equal(stale.disposition, "DENY");
  assert.ok(stale.reasonCodes.includes("TASK_EXPIRED"));
});

test("task validity windows must be internally consistent", () => {
  assert.throws(
    () => evaluateDomainAgentTask({
      identity: identity(),
      providerGrant: grant(),
      authorityLease: lease(),
      request: request({
        notBefore: "2026-09-27T18:10:00Z",
        expiresAt: "2026-09-27T18:05:00Z",
      }),
    }),
    /expiresAt must be after request.notBefore/i,
  );
});

test("grant pinning only accepts a SHA-256 fingerprint", () => {
  assert.throws(
    () => evaluateDomainAgentTask({
      identity: identity(),
      providerGrant: grant(),
      authorityLease: lease(),
      request: request({expectedGrantSha256: "not-a-digest"}),
    }),
    /expectedGrantSha256 must be a SHA-256 digest/i,
  );
});
