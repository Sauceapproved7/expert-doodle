function validPolicy(policy) {
  return Boolean(policy && typeof policy === "object" && policy.roles && typeof policy.roles === "object");
}

export function authorizeIdentity(policy, identity, capability) {
  if (!identity || typeof identity.id !== "string" || !identity.id) {
    return {allowed:false, reason:"identity_required"};
  }
  if (!identity.active) return {allowed:false, reason:"identity_inactive"};
  if (!validPolicy(policy) || !policy.roles[identity.role]) {
    return {allowed:false, reason:"unknown_role"};
  }
  const capabilities = policy.roles[identity.role].capabilities;
  if (!Array.isArray(capabilities) || !capabilities.includes(capability)) {
    return {allowed:false, reason:"capability_denied"};
  }
  return {allowed:true, reason:"explicit_grant"};
}

export function compileAccessPlan(policy, identities) {
  if (!validPolicy(policy) || !Array.isArray(identities)) return [];
  return identities
    .filter((identity) => identity?.active && typeof identity.id === "string" && policy.roles[identity.role])
    .map((identity) => ({
      identity: identity.id,
      role: identity.role,
      repositories: structuredClone(policy.roles[identity.role].repositories ?? {}),
    }))
    .sort((a,b) => a.identity.localeCompare(b.identity));
}
