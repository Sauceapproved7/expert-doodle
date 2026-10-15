import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_MAIN_CHECKS } from "./hercules-main-guard.mjs";

const BRANCH_URL = "https://api.github.com/repos/Sauceapproved7/expert-doodle/branches/main";
export const REQUIRED_PROTECTION_CHECKS = Object.freeze([...REQUIRED_MAIN_CHECKS]);

const LIMITATION = "GitHub's public branch API shows protected state and some required status checks, but cannot independently prove admin enforcement, pull-request review requirements, bypass permissions, or every ruleset setting. These require authorized administration read access.";

function report(fields) {
  return {
    schema: "sauceapproved.hercules.native-main-protection-audit",
    version: 1,
    repository: "Sauceapproved7/expert-doodle",
    branch: "main",
    ok: false,
    branchProtected: null,
    requiredChecksObserved: false,
    administrativeEnforcementVerified: false,
    expectedChecks: REQUIRED_PROTECTION_CHECKS,
    missingChecks: [],
    headSha: null,
    reason: "unverified",
    errors: [],
    limitation: LIMITATION,
    ...fields
  };
}

export async function auditNativeMainProtection({ fetchImpl = fetch } = {}) {
  let payload;
  try {
    const response = await fetchImpl(BRANCH_URL, {
      method: "GET",
      headers: {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "hercules-native-protection-audit"
      }
    });
    if (!response?.ok) {
      return report({ reason: "github_read_failed", errors: [`GitHub branch read returned HTTP ${response?.status ?? "unknown"}`] });
    }
    payload = await response.json();
  } catch (error) {
    return report({ reason: "github_read_failed", errors: [`GitHub branch read failed: ${error instanceof Error ? error.message : "unknown"}`] });
  }

  const headSha = payload?.commit?.sha;
  if (payload?.name !== "main" || !/^[a-f0-9]{40}$/i.test(headSha ?? "") ||
      typeof payload.protected !== "boolean") {
    return report({ reason: "invalid_branch_evidence", errors: ["GitHub response lacks canonical main branch, commit SHA or protected boolean"] });
  }

  if (!payload.protected) {
    return report({ reason: "main_unprotected", branchProtected: false, headSha,
      errors: ["GitHub reports the main branch is not protected"] });
  }

  const statusChecks = payload.protection?.required_status_checks;
  const checksReadable = Array.isArray(statusChecks?.contexts) || Array.isArray(statusChecks?.checks);
  if (!checksReadable || statusChecks?.enforcement_level === "off") {
    return report({ reason: "required_checks_unverified", headSha, branchProtected: true,
      errors: ["GitHub reports a protected branch, but active required status checks cannot be confirmed"] });
  }

  const contexts = new Set([
    ...(Array.isArray(statusChecks.contexts) ? statusChecks.contexts : []),
    ...(Array.isArray(statusChecks.checks) ? statusChecks.checks.map((check) => check?.context) : [])
  ].filter((value) => typeof value === "string" && value.length > 0));

  const missingChecks = REQUIRED_PROTECTION_CHECKS.filter((name) => !contexts.has(name));
  if (missingChecks.length) {
    return report({ reason: "missing_required_checks", headSha, branchProtected: true, missingChecks,
      errors: ["Missing Hercules required status checks: " + missingChecks.join(", ")] });
  }

  return report({ ok: true, reason: "observed_protected_and_required_checks",
    branchProtected: true, requiredChecksObserved: true, headSha });
}

async function main() {
  const outcome = await auditNativeMainProtection();
  console.log(JSON.stringify(outcome, null, 2));
  if (!outcome.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "native_protection_audit_failed");
    process.exitCode = 1;
  });
}
