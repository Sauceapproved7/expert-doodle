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

test("repository-wide implementation enforcement contract is present on every agent entry surface", async () => {
  for (const path of requiredTextFiles) {
    const text = await readFile(path, "utf8");
    assert.match(text, new RegExp(marker), `${path} must load the Hercules enforcement contract`);
  }
});

test("machine-readable execution contract is fail-closed and binds canonical rules", async () => {
  const policy = JSON.parse(await readFile("governance/hercules-execution-contract-v1.json", "utf8"));
  assert.equal(policy.schema, "sauceapproved.hercules.execution-contract");
  assert.equal(policy.version, 1);
  assert.equal(policy.canonicalRepository, "Sauceapproved7/expert-doodle");
  assert.equal(policy.enforcementMode, "fail-closed");
  assert.equal(policy.requireEvidenceBeforeCompletion, true);
  assert.equal(policy.requireExistingStateInspection, true);
  assert.equal(policy.forbidDuplicateRebuilds, true);
  assert.equal(policy.requireBehaviorTestsBeforeImplementation, true);
  assert.equal(policy.preserveOwnerCodeBoundary, true);
  assert.equal(policy.browserRouting?.ownedHerculesFirst, true);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.explicitOwnerSessionOnly, true);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.exportPasswords, false);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.exportCookies, false);
  assert.equal(policy.browserRouting?.personalSessionHandoff?.bypassHumanVerification, false);
  assert.equal(policy.authorizationRouting?.useAuthorizedAlternativeFirst, true);
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
