import {createHash} from "node:crypto";

function validPolicy(policy) {
  return Boolean(policy && typeof policy === "object" && policy.roles && typeof policy.roles === "object");
}

function expiryState(identity, now) {
  if (identity?.expiresAt === undefined || identity?.expiresAt === null) return "none";
  if (typeof identity.expiresAt !== "string" || !identity.expiresAt) return "invalid";
  const expiry = Date.parse(identity.expiresAt);
  const current = Date.parse(now ?? new Date().toISOString());
  if (!Number.isFinite(expiry) || !Number.isFinite(current)) return "invalid";
  return expiry <= current ? "expired" : "valid";
}

export function authorizeIdentity(policy, identity, capability, options = {}) {
  if (!identity || typeof identity.id !== "string" || !identity.id) {
    return {allowed:false, reason:"identity_required"};
  }
  if (!identity.active) return {allowed:false, reason:"identity_inactive"};
  const expiry = expiryState(identity, options.now);
  if (expiry === "invalid") return {allowed:false, reason:"identity_expiry_invalid"};
  if (expiry === "expired") return {allowed:false, reason:"identity_expired"};
  if (!validPolicy(policy) || !policy.roles[identity.role]) {
    return {allowed:false, reason:"unknown_role"};
  }
  if (policy.emergencyLockdown && !(identity.role === "owner" && capability === "identity:revoke")) {
    return {allowed:false, reason:"emergency_lockdown"};
  }
  const capabilities = policy.roles[identity.role].capabilities;
  if (!Array.isArray(capabilities) || !capabilities.includes(capability)) {
    return {allowed:false, reason:"capability_denied"};
  }
  return {allowed:true, reason:"explicit_grant"};
}

export function compileAccessPlan(policy, identities, options = {}) {
  if (!validPolicy(policy) || !Array.isArray(identities)) return [];
  return identities
    .filter((identity) => {
      if (!identity?.active || typeof identity.id !== "string" || !policy.roles[identity.role]) return false;
      const expiry = expiryState(identity, options.now);
      return expiry === "none" || expiry === "valid";
    })
    .map((identity) => ({
      identity: identity.id,
      role: identity.role,
      repositories: structuredClone(policy.roles[identity.role].repositories ?? {}),
    }))
    .sort((a,b) => a.identity.localeCompare(b.identity));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function createAuthorizationEvidence(policy, identity, capability, options = {}) {
  const record = stable({
    capability,
    decision: authorizeIdentity(policy, identity, capability, options),
    identity: identity?.id ?? null,
    policyVersion: policy?.version ?? null,
    role: identity?.role ?? null,
    timestamp: options.now ?? null,
  });
  const fingerprint = createHash("sha256").update(JSON.stringify(record)).digest("hex");
  return {...record, fingerprint};
}

export function detectPolicyDrift(baseline, current) {
  const fields = ["defaultDecision", "emergencyLockdown", "guardrails", "roles"];
  const changed = fields.filter(
    (field) => JSON.stringify(stable(baseline?.[field])) !== JSON.stringify(stable(current?.[field])),
  );
  return {drifted:changed.length > 0, fields:changed};
}
