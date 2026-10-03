import { readFile } from "node:fs/promises";

const POLICY_PATH = "governance/hercules-execution-contract-v1.json";
const MASTER_PATH = "governance/sauceapproved-master-gpt-operating-instructions-v1.md";
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

const FULL_WORKFLOW = [
  "research",
  "plan",
  "build",
  "connect",
  "test",
  "fix",
  "deploy",
  "verify",
  "document",
  "monitor",
  "optimize",
  "maintain"
];

const BUSINESS_PRIORITY = [
  "revenue",
  "customers",
  "repeat_customers",
  "recurring_revenue",
  "scalable_software_products",
  "durable_company_assets"
];

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function verifyExecutionContract() {
  const errors = [];
  let policy;
  let master;

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

  try {
    master = await readFile(MASTER_PATH, "utf8");
  } catch (error) {
    errors.push(`cannot load ${MASTER_PATH}: ${error.message}`);
    master = "";
  }

  const exact = [
    ["schema", policy.schema, "sauceapproved.hercules.execution-contract"],
    ["version", policy.version, 1],
    ["canonicalRepository", policy.canonicalRepository, "Sauceapproved7/expert-doodle"],
    ["enforcementMode", policy.enforcementMode, "fail-closed"],
    ["masterOperatingInstructions", policy.masterOperatingInstructions, MASTER_PATH],
    ["handsOffExecutionDefault", policy.handsOffExecutionDefault, true],
    ["requireExistingStateInspection", policy.requireExistingStateInspection, true],
    ["forbidDuplicateRebuilds", policy.forbidDuplicateRebuilds, true],
    ["requireEvidenceBeforeCompletion", policy.requireEvidenceBeforeCompletion, true],
    ["requireBehaviorTestsBeforeImplementation", policy.requireBehaviorTestsBeforeImplementation, true],
    ["preserveOwnerCodeBoundary", policy.preserveOwnerCodeBoundary, true],
    ["preserveProvenance", policy.preserveProvenance, true],
    ["preserveSecurityGates", policy.preserveSecurityGates, true],
    ["preserveEnvironmentBoundaries", policy.preserveEnvironmentBoundaries, true],
    ["neverWeakenGateToPass", policy.neverWeakenGateToPass, true],
    ["execution.continueOnGoBuildImplementFixFinishContinueHandle", policy.execution?.continueOnGoBuildImplementFixFinishContinueHandle, true],
    ["execution.chooseOrdinaryImplementationDetailsIndependently", policy.execution?.chooseOrdinaryImplementationDetailsIndependently, true],
    ["execution.completeIndependentWorkWhileDependencyBlocked", policy.execution?.completeIndependentWorkWhileDependencyBlocked, true],
    ["execution.preferCompletedTestedSystems", policy.execution?.preferCompletedTestedSystems, true],
    ["continuity.treatVerifiedWorkAsEstablishedState", policy.continuity?.treatVerifiedWorkAsEstablishedState, true],
    ["continuity.inspectCurrentStateBeforeChangingExistingProject", policy.continuity?.inspectCurrentStateBeforeChangingExistingProject, true],
    ["quality.highQuality", policy.quality?.highQuality, true],
    ["quality.secure", policy.quality?.secure, true],
    ["quality.reliable", policy.quality?.reliable, true],
    ["quality.scalable", policy.quality?.scalable, true],
    ["quality.professional", policy.quality?.professional, true],
    ["quality.visuallyPolished", policy.quality?.visuallyPolished, true],
    ["quality.commerciallyUsable", policy.quality?.commerciallyUsable, true],
    ["security.securityIsPartOfBuild", policy.security?.securityIsPartOfBuild, true],
    ["communication.evidenceFirstStatusReporting", policy.communication?.evidenceFirstStatusReporting, true],
    ["communication.doNotClaimWithoutEvidence", policy.communication?.doNotClaimWithoutEvidence, true],
    ["decisionModel.chooseTechnicallySoundOrdinaryOptionAndContinue", policy.decisionModel?.chooseTechnicallySoundOrdinaryOptionAndContinue, true],
    ["browserRouting.ownedHerculesFirst", policy.browserRouting?.ownedHerculesFirst, true],
    ["browserRouting.fallbackOnlyWhenUnavailableIncompatibleOrIncapable", policy.browserRouting?.fallbackOnlyWhenUnavailableIncompatibleOrIncapable, true],
    ["browserRouting.recordFallbackReason", policy.browserRouting?.recordFallbackReason, true],
    ["browserRouting.personalSessionHandoff.explicitOwnerSessionOnly", policy.browserRouting?.personalSessionHandoff?.explicitOwnerSessionOnly, true],
    ["browserRouting.personalSessionHandoff.exportPasswords", policy.browserRouting?.personalSessionHandoff?.exportPasswords, false],
    ["browserRouting.personalSessionHandoff.exportCookies", policy.browserRouting?.personalSessionHandoff?.exportCookies, false],
    ["browserRouting.personalSessionHandoff.exportCredentials", policy.browserRouting?.personalSessionHandoff?.exportCredentials, false],
    ["browserRouting.personalSessionHandoff.bypassHumanVerification", policy.browserRouting?.personalSessionHandoff?.bypassHumanVerification, false],
    ["browserRouting.personalSessionHandoff.bypassProviderSecurityControls", policy.browserRouting?.personalSessionHandoff?.bypassProviderSecurityControls, false],
    ["authorizationRouting.useAuthorizedAlternativeFirst", policy.authorizationRouting?.useAuthorizedAlternativeFirst, true],
    ["authorizationRouting.completeAllNonOwnerWorkBeforeStopping", policy.authorizationRouting?.completeAllNonOwnerWorkBeforeStopping, true],
    ["authorizationRouting.bypassAccessControls", policy.authorizationRouting?.bypassAccessControls, false],
    ["authorizationRouting.bypassCaptchaOrAntiBot", policy.authorizationRouting?.bypassCaptchaOrAntiBot, false],
    ["authorizationRouting.bypass2FA", policy.authorizationRouting?.bypass2FA, false],
    ["authorizationRouting.treatMissingConsentAsGranted", policy.authorizationRouting?.treatMissingConsentAsGranted, false],
    ["authorizationRouting.evadeProviderRestrictions", policy.authorizationRouting?.evadeProviderRestrictions, false],
    ["founderDirectives.strengthAndNameStandard.enabled", policy.founderDirectives?.strengthAndNameStandard?.enabled, true],
    ["founderDirectives.outsideTheBoxBuildRule.enabled", policy.founderDirectives?.outsideTheBoxBuildRule?.enabled, true],
    ["founderDirectives.billionDollarOperatingStandard.enabled", policy.founderDirectives?.billionDollarOperatingStandard?.enabled, true],
    ["founderDirectives.marketLeadershipMindset.enabled", policy.founderDirectives?.marketLeadershipMindset?.enabled, true],
    ["founderDirectives.differentiatorRequirement.minimumPerBuild", policy.founderDirectives?.differentiatorRequirement?.minimumPerBuild, 2],
    ["founderDirectives.doYouExecutionCommand.enabled", policy.founderDirectives?.doYouExecutionCommand?.enabled, true],
    ["founderDirectives.doYouExecutionCommand.useBestProfessionalJudgment", policy.founderDirectives?.doYouExecutionCommand?.useBestProfessionalJudgment, true],
    ["founderDirectives.doYouExecutionCommand.doNotRequireFounderToDirectRoutineTechnicalWork", policy.founderDirectives?.doYouExecutionCommand?.doNotRequireFounderToDirectRoutineTechnicalWork, true],
    ["founderDirectives.doYouExecutionCommand.preserveOwnerOnlySecurityAndAuthorizationBoundaries", policy.founderDirectives?.doYouExecutionCommand?.preserveOwnerOnlySecurityAndAuthorizationBoundaries, true],
    ["founderDirectives.nightlyWholeHerculesAudit.requiredOperatingTarget", policy.founderDirectives?.nightlyWholeHerculesAudit?.requiredOperatingTarget, true]
  ];

  for (const [name, actual, expected] of exact) {
    if (actual !== expected) errors.push(`${name} must be ${JSON.stringify(expected)}`);
  }

  if (JSON.stringify(policy.fullWorkflow) !== JSON.stringify(FULL_WORKFLOW)) {
    errors.push("fullWorkflow does not match the canonical execution chain");
  }

  if (JSON.stringify(policy.businessPriority) !== JSON.stringify(BUSINESS_PRIORITY)) {
    errors.push("businessPriority does not match the canonical commercial sequence");
  }

  if (JSON.stringify(policy.ownerOnlyBoundaries) !== JSON.stringify(OWNER_ONLY)) {
    errors.push("ownerOnlyBoundaries do not match the canonical owner-only boundary set");
  }

  const masterRequiredText = [
    "The user talks. The system builds.",
    "Research → Plan → Build → Connect → Test → Fix → Deploy → Verify → Document → Monitor → Optimize → Maintain",
    "HANDS-OFF EXECUTION DEFAULT",
    "Hercules Browser is the default browser execution path",
    "Revenue → Customers → Repeat customers → Recurring revenue → Scalable software/products → Durable company assets",
    "What changed → What was verified → What remains → Next highest-value action",
    '### "DO YOU" EXECUTION COMMAND',
    'When the founder says "do you," Hercules should handle the work using its best professional judgment'
  ];

  for (const required of masterRequiredText) {
    if (!master.includes(required)) errors.push(`${MASTER_PATH} missing required operating rule: ${required}`);
  }

  for (const path of ENTRY_SURFACES) {
    try {
      const text = await readFile(path, "utf8");
      if (!text.includes(MARKER)) errors.push(`${path} does not load ${MARKER}`);
      if (!text.includes(POLICY_PATH)) errors.push(`${path} does not reference ${POLICY_PATH}`);
      if (!text.includes(MASTER_PATH)) errors.push(`${path} does not reference ${MASTER_PATH}`);
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
    masterOperatingInstructions: MASTER_PATH,
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
