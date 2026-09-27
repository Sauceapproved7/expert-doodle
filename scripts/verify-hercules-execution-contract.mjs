import { readFile } from "node:fs/promises";

const POLICY_PATH = "governance/hercules-execution-contract-v1.json";
const MARKER = "HERCULES_IMPLEMENTATION_ENFORCEMENT_V1";
const ENTRY_SURFACES = [
  "AGENTS.md",
  ".github/copilot-instructions.md",
  "CONTRIBUTING.md",
  ".github/PULL_REQUEST_TEMPLATE.md"
];

const OWNER_ONLY = [
  "payments",
  "private_credentials_or_2fa",
  "identity_verification",
  "legally_binding_consent",
  "required_permission_grants",
  "irreversible_high_impact_owner_decisions",
  "physical_world_actions",
  "information_only_the_owner_possesses"
];

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function verifyExecutionContract() {
  const errors = [];
  let policy;

  try {
    policy = await loadJson(POLICY_PATH);
  } catch (error) {
    return {
      schema: "sauceapproved.hercules.execution-contract-verification",
      version: 1,
      ok: false,
      errors: [`cannot load ${POLICY_PATH}: ${error.message}`]
    };
  }

  const exact = [
    ["schema", policy.schema, "sauceapproved.hercules.execution-contract"],
    ["version", policy.version, 1],
    ["canonicalRepository", policy.canonicalRepository, "Sauceapproved7/expert-doodle"],
    ["enforcementMode", policy.enforcementMode, "fail-closed"],
    ["requireExistingStateInspection", policy.requireExistingStateInspection, true],
    ["forbidDuplicateRebuilds", policy.forbidDuplicateRebuilds, true],
    ["requireEvidenceBeforeCompletion", policy.requireEvidenceBeforeCompletion, true],
    ["requireBehaviorTestsBeforeImplementation", policy.requireBehaviorTestsBeforeImplementation, true],
    ["preserveOwnerCodeBoundary", policy.preserveOwnerCodeBoundary, true],
    ["preserveProvenance", policy.preserveProvenance, true],
    ["preserveSecurityGates", policy.preserveSecurityGates, true],
    ["preserveEnvironmentBoundaries", policy.preserveEnvironmentBoundaries, true],
    ["neverWeakenGateToPass", policy.neverWeakenGateToPass, true],
    ["browserRouting.ownedHerculesFirst", policy.browserRouting?.ownedHerculesFirst, true],
    ["browserRouting.personalSessionHandoff.explicitOwnerSessionOnly", policy.browserRouting?.personalSessionHandoff?.explicitOwnerSessionOnly, true],
    ["browserRouting.personalSessionHandoff.exportPasswords", policy.browserRouting?.personalSessionHandoff?.exportPasswords, false],
    ["browserRouting.personalSessionHandoff.exportCookies", policy.browserRouting?.personalSessionHandoff?.exportCookies, false],
    ["browserRouting.personalSessionHandoff.exportCredentials", policy.browserRouting?.personalSessionHandoff?.exportCredentials, false],
    ["browserRouting.personalSessionHandoff.bypassHumanVerification", policy.browserRouting?.personalSessionHandoff?.bypassHumanVerification, false],
    ["browserRouting.personalSessionHandoff.bypassProviderSecurityControls", policy.browserRouting?.personalSessionHandoff?.bypassProviderSecurityControls, false],
    ["authorizationRouting.useAuthorizedAlternativeFirst", policy.authorizationRouting?.useAuthorizedAlternativeFirst, true],
    ["authorizationRouting.bypassAccessControls", policy.authorizationRouting?.bypassAccessControls, false],
    ["authorizationRouting.bypassCaptchaOrAntiBot", policy.authorizationRouting?.bypassCaptchaOrAntiBot, false],
    ["authorizationRouting.bypass2FA", policy.authorizationRouting?.bypass2FA, false],
    ["authorizationRouting.treatMissingConsentAsGranted", policy.authorizationRouting?.treatMissingConsentAsGranted, false],
    ["authorizationRouting.evadeProviderRestrictions", policy.authorizationRouting?.evadeProviderRestrictions, false]
  ];

  for (const [name, actual, expected] of exact) {
    if (actual !== expected) errors.push(`${name} must be ${JSON.stringify(expected)}`);
  }

  if (JSON.stringify(policy.ownerOnlyBoundaries) !== JSON.stringify(OWNER_ONLY)) {
    errors.push("ownerOnlyBoundaries do not match the canonical owner-only boundary set");
  }

  for (const path of ENTRY_SURFACES) {
    try {
      const text = await readFile(path, "utf8");
      if (!text.includes(MARKER)) errors.push(`${path} does not load ${MARKER}`);
      if (!text.includes(POLICY_PATH)) errors.push(`${path} does not reference ${POLICY_PATH}`);
    } catch (error) {
      errors.push(`cannot load required agent entry surface ${path}: ${error.message}`);
    }
  }

  return {
    schema: "sauceapproved.hercules.execution-contract-verification",
    version: 1,
    ok: errors.length === 0,
    errors,
    policy: POLICY_PATH,
    entrySurfaces: ENTRY_SURFACES.length
  };
}

async function main() {
  const result = await verifyExecutionContract();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
