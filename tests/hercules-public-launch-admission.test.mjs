import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {evaluatePublicLaunchAdmission, evaluatePublicLaunchAdmissionFile} from "../scripts/hercules-public-launch-admission.mjs";

const SHA = "a".repeat(40);
const NOW = Date.parse("2026-10-13T12:00:00.000Z");

function fullyVerified() {
  return {
    build: {ownerCode:true,provenance:true,workflowSyntax:true,tests:true},
    security: {securityBaseline:true,codeql:true,authHardening:true},
    deployment: {signedRelease:true,verifiedDeployment:true,criticalHealth:true,noOpenCriticalIncidents:true},
    rollback: {rollbackReady:true},
    smoke: {storefrontSmoke:true,checkoutSmoke:true,finalCustomerSmoke:true},
    domain: {customDomainComplete:true},
    commercial: {pricing:true,terms:true,privacy:true},
    release: {ownerPublicReleaseApproval:true},
  };
}

function packet(overrides = {}) {
  return {
    schema: "sauceapproved.hercules.public-launch-admission",
    version: 1,
    environment: "production",
    sourceCommit: SHA,
    checkedAt: "2026-10-13T11:55:00.000Z",
    evidence: fullyVerified(),
    ...overrides,
  };
}

test("a fresh, commit-bound, fully verified packet is eligible but does not perform a release", () => {
  const result = evaluatePublicLaunchAdmission(packet(), {expectedCommit: SHA, now: NOW});
  assert.equal(result.ok, true);
  assert.equal(result.eligibleForPublicRelease, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.sourceCommit, SHA);
});

test("missing owner authorization fails closed even with all other evidence green", () => {
  const evidence = fullyVerified();
  evidence.release.ownerPublicReleaseApproval = false;
  const result = evaluatePublicLaunchAdmission(packet({evidence}), {expectedCommit: SHA, now: NOW});
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("release.ownerPublicReleaseApproval"));
});

test("stale, future-dated, or missing timestamps cannot authorize a public launch", () => {
  for (const checkedAt of ["2026-10-13T10:59:00.000Z", "2026-10-13T12:02:00.000Z", ""]) {
    const result = evaluatePublicLaunchAdmission(packet({checkedAt}), {expectedCommit: SHA, now: NOW});
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes("admission.checkedAt"));
  }
});

test("the exact released commit is mandatory, not a branch name or another commit", () => {
  for (const sourceCommit of ["b".repeat(40), "main", "", "A".repeat(40)]) {
    const result = evaluatePublicLaunchAdmission(packet({sourceCommit}), {expectedCommit: SHA, now: NOW});
    assert.equal(result.ok, false);
    assert.ok(result.blockers.includes("admission.sourceCommit"));
  }
});

test("invalid schema, staging, absent proof, or missing expected commit fail closed", () => {
  for (const mutation of [
    {schema:"wrong"},
    {version:2},
    {environment:"staging"},
    {evidence:null},
  ]) {
    const result = evaluatePublicLaunchAdmission(packet(mutation), {expectedCommit: SHA, now: NOW});
    assert.equal(result.ok, false);
  }
  assert.equal(evaluatePublicLaunchAdmission(packet(), {now: NOW}).ok, false);
  assert.equal(evaluatePublicLaunchAdmission(null, {expectedCommit: SHA, now: NOW}).ok, false);
});

test("one missing technical check always remains a blocker", () => {
  const evidence = fullyVerified();
  delete evidence.security.codeql;
  const result = evaluatePublicLaunchAdmission(packet({evidence}), {expectedCommit: SHA, now: NOW});
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes("security.codeql"));
});

test("evidence file cannot escape the one sanctioned release-evidence path", async () => {
  await assert.rejects(
    evaluatePublicLaunchAdmissionFile("releases/public-launch/" + SHA + ".json", SHA, {now: NOW}),
    /evidence_path_must_match_release_commit/
  );
});

test("tag workflow enforces single-parent evidence-only commit before release admission", async () => {
  const workflow = await readFile(new URL("../.github/workflows/hercules-release-gate-v1.yml", import.meta.url), "utf8");
  assert.match(workflow, /fetch-depth: 2/);
  assert.match(workflow, /git rev-list --parents/);
  assert.match(workflow, /parent_count/);
  assert.match(workflow, /git rev-parse/);
  assert.match(workflow, /git diff --name-only/);
  assert.match(workflow, /releases\\/public-launch\\/evidence\\.json/);
  assert.match(workflow, /--commit "\$source_commit"/);
});
