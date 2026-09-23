export const FORGE_OWNERSHIP_POLICY_VERSION = "1.0";
export const FORGE_OWNED_ENGINE = "hercules-forge-owned-core";
export const FORGE_DECLARED_RIGHTS_HOLDER = "Sauceapproved7";

export function createOwnerCodeAttestation({engine = FORGE_OWNED_ENGINE} = {}) {
  if (engine !== FORGE_OWNED_ENGINE) {
    throw new Error("owner-code-only policy requires the Hercules Forge owned core");
  }

  return {
    policyVersion: FORGE_OWNERSHIP_POLICY_VERSION,
    buildScope: "owner-code-only",
    declaredRightsHolder: FORGE_DECLARED_RIGHTS_HOLDER,
    engine,
    thirdPartyCodeIncluded: false,
  };
}

export function assertOwnerCodeAttestation(value, context = "Forge operation") {
  const valid = Boolean(
    value
      && value.policyVersion === FORGE_OWNERSHIP_POLICY_VERSION
      && value.buildScope === "owner-code-only"
      && value.declaredRightsHolder === FORGE_DECLARED_RIGHTS_HOLDER
      && value.engine === FORGE_OWNED_ENGINE
      && value.thirdPartyCodeIncluded === false
  );

  if (!valid) {
    throw new Error(
      context
        + " blocked: owner-code-only provenance is required and third-party code must be excluded",
    );
  }

  return value;
}
