import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requiredTextFiles = [
  "AGENTS.md",
  ".github/copilot-instructions.md",
  "CONTRIBUTING.md",
  ".github/PULL_REQUEST_TEMPLATE.md"
];

const marker = "HERCULES_IMPLEMENTATION_ENFORCEMENT_V1";
const policyPath = "governance/hercules-execution-contract-v1.json";
const masterPath = "governance/sauceapproved-master-gpt-operating-instructions-v1.md";

test("repository-wide implementation enforcement contract is present on every agent entry surface", async () => {
  for (const path of requiredTextFiles) {
    const fileText = await readFile(path, "utf8");
    assert.ok(fileText.includes(marker), `${path} must load the Hercules enforcement contract`);
    assert.ok(fileText.includes(masterPath), `${path} must load the master operating instructions`);
  }
});

test("master operating instructions encode the founder execution model", async () => {
  const master = await readFile(masterPath, "utf8");
  assert.ok(master.includes("The user talks. The system builds."));
  assert.ok(master.includes("Research → Plan → Build → Connect → Test → Fix → Deploy → Verify → Document → Monitor → Optimize → Maintain"));
  assert.ok(master.includes("HANDS-OFF EXECUTION DEFAULT"));
  assert.ok(master.includes("Hercules Browser is the default browser execution path"));
  assert.ok(master.includes("Revenue → Customers → Repeat customers → Recurring revenue → Scalable software/products → Durable company assets"));
  assert.ok(master.includes("What changed → What was verified → What remains → Next highest-value action"));
});

test("machine-readable execution contract is fail-closed and binds canonical rules", async () => {
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  assert.equal(policy.schema, "sauceapproved.hercules.execution-contract");
  assert.equal(policy.version, 1);
  assert.equal(policy.canonicalRepository, "Sauceapproved7/expert-doodle");
  assert.equal(policy.enforcementMode, "fail-closed");
  assert.equal(policy.masterOperatingInstructions, masterPath);
  assert.equal(policy.handsOffExecutionDefault, true);
  assert.deepEqual(policy.fullWorkflow, [
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
  ]);
  assert.equal(policy.requireEvidenceBeforeCompletion, true);
  assert.equal(policy.requireExistingStateInspection, true);
  assert.equal(policy.forbidDuplicateRebuilds, true);
  assert.equal(policy.requireBehaviorTestsBeforeImplementation, true);
  assert.equal(policy.preserveOwnerCodeBoundary, true);
  assert.equal(policy.continuity?.treatVerifiedWorkAsEstablishedState, true);
  assert.equal(policy.execution?.continueOnGoBuildImplementFixFinishContinueHandle, true);
  assert.equal(policy.execution?.chooseOrdinaryImplementationDetailsIndependently, true);
  assert.equal(policy.execution?.completeIndependentWorkWhileDependencyBlocked, true);
  assert.equal(policy.quality?.commerciallyUsable, true);
  assert.equal(policy.quality?.visuallyPolished, true);
  assert.equal(policy.security?.securityIsPartOfBuild, true);
  assert.equal(policy.communication?.evidenceFirstStatusReporting, true);
  assert.deepEqual(policy.businessPriority, [
    "revenue",
    "customers",
    "repeat_customers",
    "recurring_revenue",
    "scalable_software_products",
    "durable_company_assets"
  ]);
  assert.equal(policy.browserRouting?.ownedHerculesFirst, true);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.explicitOwnerSessionOnly, true);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.exportPasswords, false);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.exportCookies, false);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.bypassHumanVerification, false);
  assert.equal(policy.authorizationRouting?.useAuthorizedAlternativeFirst, true);
  assert.equal(policy.authorizationRouting?.completeAllNonOwnerWorkBeforeStopping, true);
  assert.equal(policy.authorizationRouting?.bypassAccessControls, false);
  assert.deepEqual(policy.ownerOnlyBoundaries, [
    "payments",
    "private_credentials_or_2fa",
    "identity_verification",
    "legally_binding_consent",
    "required_permission_grants",
    "irreversible_high_impact_owner_decisions",
    "physical_world_actions",
    "information_only_the_owner_possesses"
  ]);
});

test("execution-contract verifier reports compliant repository state", async () => {
  const { verifyExecutionContract } = await import("../scripts/verify-hercules-execution-contract.mjs");
  const result = await verifyExecutionContract();
  assert.equal(result.ok, true, result.errors?.join("\n"));
  assert.equal(result.schema, "sauceapproved.hercules.execution-contract-verification");
});
