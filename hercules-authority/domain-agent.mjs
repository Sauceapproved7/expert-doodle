import {createHash} from "node:crypto";
import {evaluateAuthorityLease, verifyAuthorityLease} from "./authority-lease.mjs";

const SHA256 = /^[a-f0-9]{64}$/i;
const STATUS = new Set(["active", "revoked", "suspended"]);
const OWNER_ONLY = new Set([
  "payments",
  "private_credentials_or_2fa",
  "identity_verification",
  "legally_binding_consent",
  "required_permission_grants",
  "irreversible_high_impact_owner_decisions",
  "physical_world_actions",
  "information_only_the_owner_possesses",
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function requiredString(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError(name + " is required");
  return text;
}

function instant(value, name) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new TypeError(name + " must be a valid timestamp");
  return new Date(ms).toISOString();
}

function normalizedStrings(values, name) {
  if (!Array.isArray(values)) throw new TypeError(name + " must be an array");
  const result = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
  if (!result.length) throw new TypeError(name + " must not be empty");
  return result;
}

function validateHostname(domain) {
  const value = requiredString(domain, "domain").toLowerCase();
  if (value.includes("://") || value.includes("/") || value.includes(":")) {
    throw new TypeError("domain must be a hostname without protocol, path, or port");
  }
  if (!value.includes(".")) throw new TypeError("domain must be a public domain hostname");
  if (value.length > 253) throw new TypeError("domain hostname is too long");
  const labels = value.split(".");
  for (const label of labels) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
      throw new TypeError("domain must be a valid hostname");
    }
  }
  return value;
}

function assertNoCredentialMaterial(value, path = "input") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const current = path + "." + key;
    if (/(?:^|_)(?:password|passwd|secret|access.?token|refresh.?token|id.?token|api.?key|private.?key|client.?secret|cookie|credentials?)(?:$|_)/i.test(key)
      || /^(?:password|passwd|secret|accessToken|refreshToken|idToken|apiKey|privateKey|clientSecret|cookie|credentials)$/i.test(key)) {
      throw new TypeError("credential material is not allowed in provider grant records: " + current);
    }
    if (child && typeof child === "object") assertNoCredentialMaterial(child, current);
  }
}

export function createDomainAgentIdentity(input = {}) {
  const domain = validateHostname(input.domain);
  const tenantId = requiredString(input.tenantId, "tenantId");
  const agentId = requiredString(input.agentId, "agentId");
  const origin = "https://" + domain;
  const body = Object.freeze({
    schema: "hercules.domain-agent.identity.v1",
    domain,
    origin,
    tenantId,
    agentId,
    subject: origin + "/agents/" + encodeURIComponent(agentId),
    discoveryUrl: origin + "/.well-known/hercules-agent.json",
    executionAuthority: false,
  });
  return body;
}

export function createProviderGrantRecord(input = {}) {
  assertNoCredentialMaterial(input);
  const authorizationEvidenceSha256 = String(input.authorizationEvidenceSha256 ?? "").toLowerCase();
  if (!SHA256.test(authorizationEvidenceSha256)) {
    throw new TypeError("authorizationEvidenceSha256 must be a SHA-256 digest");
  }
  const status = requiredString(input.status, "status").toLowerCase();
  if (!STATUS.has(status)) throw new TypeError("status must be active, revoked, or suspended");

  const body = {
    schema: "hercules.domain-agent.provider-grant.v1",
    tenantId: requiredString(input.tenantId, "tenantId"),
    provider: requiredString(input.provider, "provider").toLowerCase(),
    connectionRef: requiredString(input.connectionRef, "connectionRef"),
    authorizationEvidenceSha256,
    scopes: normalizedStrings(input.scopes, "scopes"),
    status,
    refreshable: input.refreshable === true,
    authorizedAt: instant(input.authorizedAt, "authorizedAt"),
    expiresAt: input.expiresAt == null ? null : instant(input.expiresAt, "expiresAt"),
    carriesCredentials: false,
    executionAuthority: false,
  };
  if (body.expiresAt && Date.parse(body.expiresAt) <= Date.parse(body.authorizedAt)) {
    throw new TypeError("expiresAt must be after authorizedAt");
  }
  return Object.freeze({...body, grantSha256: digest(body)});
}

export function createAgentDiscoveryDocument(identity) {
  if (identity?.schema !== "hercules.domain-agent.identity.v1") {
    throw new TypeError("valid Hercules domain agent identity required");
  }
  return Object.freeze({
    schema: "hercules.domain-agent.discovery.v1",
    agent: {
      id: identity.agentId,
      tenantId: identity.tenantId,
      subject: identity.subject,
      origin: identity.origin,
    },
    endpoints: {
      health: identity.origin + "/health",
      tasks: identity.origin + "/v1/tasks",
      discovery: identity.discoveryUrl,
    },
    capabilities: {
      aiRouting: true,
      providerGrantReuse: true,
      automaticRefresh: true,
      scopedAuthority: true,
      idempotentExecution: true,
      auditFingerprints: true,
      multiTenantIsolation: true,
      ownerBoundaryDetection: true,
      grantFingerprintPinning: true,
      taskValidityWindows: true,
    },
    security: {
      leastPrivilege: true,
      failClosed: true,
      rawCredentialsAccepted: false,
      bypassAuthorization: false,
      bypass2FA: false,
      bypassProviderControls: false,
    },
  });
}

function decision({
  identity,
  request,
  disposition,
  reasonCodes,
  executionEligible = false,
  requiresOwnerInteraction = false,
}) {
  const normalizedReasons = [...new Set(reasonCodes)].sort();
  const body = {
    schema: "hercules.domain-agent.decision.v1",
    agentSubject: identity?.subject ?? null,
    tenantId: request?.tenantId ?? null,
    requestId: request?.id ?? null,
    provider: request?.provider ?? null,
    resource: request?.resource ?? null,
    action: request?.action ?? null,
    impact: request?.impact ?? null,
    at: request?.at ?? null,
    disposition,
    executionEligible,
    requiresOwnerInteraction,
    reasonCodes: normalizedReasons,
    executionAuthority: false,
  };
  return Object.freeze({...body, decisionSha256: digest(body)});
}

export function evaluateDomainAgentTask({
  identity,
  providerGrant,
  authorityLease,
  request,
} = {}) {
  if (identity?.schema !== "hercules.domain-agent.identity.v1") {
    throw new TypeError("valid Hercules domain agent identity required");
  }
  if (!request || typeof request !== "object") throw new TypeError("request is required");

  const requestAt = instant(request.at, "request.at");
  const normalizedRequest = {
    ...request,
    id: requiredString(request.id, "request.id"),
    tenantId: requiredString(request.tenantId, "request.tenantId"),
    provider: requiredString(request.provider, "request.provider").toLowerCase(),
    resource: requiredString(request.resource, "request.resource"),
    action: requiredString(request.action, "request.action"),
    impact: requiredString(request.impact, "request.impact"),
    at: requestAt,
    requiredScopes: normalizedStrings(request.requiredScopes, "request.requiredScopes"),
    expectedGrantSha256: request.expectedGrantSha256 == null
      ? null
      : String(request.expectedGrantSha256).trim().toLowerCase(),
    notBefore: request.notBefore == null ? null : instant(request.notBefore, "request.notBefore"),
    expiresAt: request.expiresAt == null ? null : instant(request.expiresAt, "request.expiresAt"),
  };

  if (normalizedRequest.expectedGrantSha256 && !SHA256.test(normalizedRequest.expectedGrantSha256)) {
    throw new TypeError("request.expectedGrantSha256 must be a SHA-256 digest");
  }
  if (
    normalizedRequest.notBefore
    && normalizedRequest.expiresAt
    && Date.parse(normalizedRequest.expiresAt) <= Date.parse(normalizedRequest.notBefore)
  ) {
    throw new TypeError("request.expiresAt must be after request.notBefore");
  }

  if (identity.tenantId !== normalizedRequest.tenantId) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["TENANT_MISMATCH"],
    });
  }

  if (normalizedRequest.notBefore && Date.parse(requestAt) < Date.parse(normalizedRequest.notBefore)) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["TASK_NOT_YET_VALID"],
    });
  }
  if (normalizedRequest.expiresAt && Date.parse(requestAt) >= Date.parse(normalizedRequest.expiresAt)) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["TASK_EXPIRED"],
    });
  }

  if (normalizedRequest.ownerBoundary != null) {
    const boundary = String(normalizedRequest.ownerBoundary);
    if (!OWNER_ONLY.has(boundary)) {
      return decision({
        identity, request: normalizedRequest, disposition: "DENY",
        reasonCodes: ["INVALID_OWNER_BOUNDARY"],
      });
    }
    return decision({
      identity, request: normalizedRequest, disposition: "OWNER_ACTION_REQUIRED",
      reasonCodes: ["OWNER_ONLY_BOUNDARY"],
      requiresOwnerInteraction: true,
    });
  }

  if (!providerGrant) {
    return decision({
      identity, request: normalizedRequest, disposition: "OWNER_ACTION_REQUIRED",
      reasonCodes: ["PROVIDER_CONNECTION_REQUIRED"],
      requiresOwnerInteraction: true,
    });
  }

  if (providerGrant.schema !== "hercules.domain-agent.provider-grant.v1") {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["INVALID_PROVIDER_GRANT"],
    });
  }
  if (providerGrant.tenantId !== normalizedRequest.tenantId) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["TENANT_MISMATCH"],
    });
  }
  if (providerGrant.provider !== normalizedRequest.provider) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["PROVIDER_MISMATCH"],
    });
  }
  if (
    normalizedRequest.expectedGrantSha256
    && providerGrant.grantSha256 !== normalizedRequest.expectedGrantSha256
  ) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["PROVIDER_GRANT_PIN_MISMATCH"],
    });
  }

  if (providerGrant.status === "revoked") {
    return decision({
      identity, request: normalizedRequest, disposition: "OWNER_ACTION_REQUIRED",
      reasonCodes: ["PROVIDER_GRANT_REVOKED"],
      requiresOwnerInteraction: true,
    });
  }
  if (providerGrant.status !== "active") {
    return decision({
      identity, request: normalizedRequest, disposition: "OWNER_ACTION_REQUIRED",
      reasonCodes: ["PROVIDER_GRANT_INACTIVE"],
      requiresOwnerInteraction: true,
    });
  }

  const missingScopes = normalizedRequest.requiredScopes.filter(
    (scope) => !providerGrant.scopes.includes(scope),
  );
  if (missingScopes.length) {
    return decision({
      identity, request: normalizedRequest, disposition: "OWNER_ACTION_REQUIRED",
      reasonCodes: ["PROVIDER_SCOPE_GRANT_REQUIRED"],
      requiresOwnerInteraction: true,
    });
  }

  if (providerGrant.expiresAt && Date.parse(providerGrant.expiresAt) <= Date.parse(requestAt)) {
    if (providerGrant.refreshable) {
      return decision({
        identity, request: normalizedRequest, disposition: "REFRESH_REQUIRED",
        reasonCodes: ["PROVIDER_GRANT_EXPIRED"],
      });
    }
    return decision({
      identity, request: normalizedRequest, disposition: "OWNER_ACTION_REQUIRED",
      reasonCodes: ["PROVIDER_REAUTHORIZATION_REQUIRED"],
      requiresOwnerInteraction: true,
    });
  }

  if (!verifyAuthorityLease(authorityLease ?? {}).valid) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["AUTHORITY_LEASE_DENIED"],
    });
  }
  if (authorityLease.subject?.type !== "domain-agent" || authorityLease.subject?.id !== identity.agentId) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["AGENT_IDENTITY_MISMATCH"],
    });
  }
  if (authorityLease.intent?.id !== normalizedRequest.id) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["INTENT_MISMATCH"],
    });
  }
  if (authorityLease.authorization?.evidenceSha256 !== providerGrant.authorizationEvidenceSha256) {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["AUTHORIZATION_EVIDENCE_MISMATCH"],
    });
  }

  const leaseDecision = evaluateAuthorityLease(authorityLease, {
    resource: normalizedRequest.resource,
    action: normalizedRequest.action,
    impact: normalizedRequest.impact,
    at: requestAt,
  });
  if (leaseDecision.disposition !== "WITHIN_DECLARED_LEASE") {
    return decision({
      identity, request: normalizedRequest, disposition: "DENY",
      reasonCodes: ["AUTHORITY_LEASE_DENIED", ...leaseDecision.reasonCodes],
    });
  }

  return decision({
    identity,
    request: normalizedRequest,
    disposition: "EXECUTE",
    reasonCodes: ["AUTHORIZED_PROVIDER_GRANT", "WITHIN_DECLARED_LEASE"],
    executionEligible: true,
  });
}
