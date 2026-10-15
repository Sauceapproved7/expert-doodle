import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditNativeMainProtection, REQUIRED_PROTECTION_CHECKS } from "../scripts/hercules-native-main-protection-audit.mjs";

const API = "https://api.github.com/repos/Sauceapproved7/expert-doodle/branches/main";
function fakeFetch(body, status = 200) {
  return async (url, options) => {
    assert.equal(url, API);
    assert.equal(options?.method, "GET");
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}
const contexts = [...REQUIRED_PROTECTION_CHECKS];
const sha = "a".repeat(40);

test("unprotected branch produces a failed, evidence-based status", async () => {
  const result = await auditNativeMainProtection({ fetchImpl: fakeFetch({
    name: "main", commit: { sha }, protected: false,
    protection: { required_status_checks: { enforcement_level: "off", contexts: [], checks: [] } }
  }) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "main_unprotected");
  assert.equal(result.branchProtected, false);
  assert.equal(result.headSha, sha);
});

test("branch protection must require all eight Hercules gates", async () => {
  assert.ok(REQUIRED_PROTECTION_CHECKS.includes("universal-merge-gates"));
  const result = await auditNativeMainProtection({ fetchImpl: fakeFetch({
    name: "main", commit: { sha }, protected: true,
    protection: { required_status_checks: { enforcement_level: "non_admins", contexts } }
  }) });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.branchProtected, true);
  assert.equal(result.requiredChecksObserved, true);
  assert.equal(result.administrativeEnforcementVerified, false);
  assert.match(result.limitation, /administrat/i);
});

test("protected branch missing the completion gate fails closed", async () => {
  const result = await auditNativeMainProtection({ fetchImpl: fakeFetch({
    name: "main", commit: { sha }, protected: true,
    protection: { required_status_checks: { enforcement_level: "non_admins",
      contexts: contexts.filter((name) => name !== "universal-merge-gates") } }
  }) });
  assert.equal(result.ok, false);
  assert.ok(result.missingChecks.includes("universal-merge-gates"));
});

test("protected without readable check contexts remains unverified", async () => {
  const result = await auditNativeMainProtection({ fetchImpl: fakeFetch({
    name: "main", commit: { sha }, protected: true
  }) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "required_checks_unverified");
});

test("HTTP errors, wrong branch, missing head and malformed server data fail closed", async () => {
  const denied = await auditNativeMainProtection({ fetchImpl: fakeFetch({ message: "Forbidden" }, 403) });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "github_read_failed");
  for (const body of [null, {}, { name: "develop", protected: true, commit: { sha } },
    { name: "main", protected: true, commit: { sha: "oops" } }]) {
    const result = await auditNativeMainProtection({ fetchImpl: fakeFetch(body) });
    assert.equal(result.ok, false);
  }
  const thrown = await auditNativeMainProtection({ fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(thrown.ok, false);
});

test("auditor never writes data or requests a GitHub token", async () => {
  const source = await readFile("scripts/hercules-native-main-protection-audit.mjs", "utf8");
  assert.doesNotMatch(source, /Authorization\s*:/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(source, /process\.env\.(?:GH_TOKEN|GITHUB_TOKEN)/);
});

test("native protection audit runs on daily scheduler and manual trigger, not on ordinary PRs", async () => {
  const workflow = await readFile(".github/workflows/hercules-github-main-protection.yml", "utf8");
  assert.match(workflow, /schedule:[\s\S]*cron:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /native-protection-audit:[\s\S]*if:\s*github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /node scripts\/hercules-native-main-protection-audit\.mjs/);
  assert.match(workflow, /contents:\s*read/);
});
