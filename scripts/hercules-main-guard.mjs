import { readFile } from "node:fs/promises";

export const REQUIRED_MAIN_CHECKS = Object.freeze([
  "implementation-enforcement",
  "owner-code-only",
  "security-baseline",
  "codeql",
  "workflow-integrity",
  "provenance-attestation",
  "main-guard-contract"
]);

export const RESTORE_MARKER = "Hercules main guard: restore protected tree";

function successfulCheckNames(checkRuns) {
  const names = new Set();
  const runs = Array.isArray(checkRuns?.check_runs) ? checkRuns.check_runs : [];
  for (const run of runs) {
    if (
      typeof run?.name === "string" &&
      run.status === "completed" &&
      run.conclusion === "success"
    ) {
      names.add(run.name);
    }
  }
  return names;
}

export function classifyMainPush({ event, associatedPrs, checkRuns }) {
  const before = String(event?.before || "");
  const after = String(event?.after || "");
  const sender = String(event?.sender?.login || event?.pusher?.name || "");
  const message = String(event?.head_commit?.message || "");

  if (
    message.startsWith(RESTORE_MARKER) &&
    (sender === "github-actions[bot]" || sender === "github-actions")
  ) {
    return {
      authorized: true,
      reason: "guard_restore",
      before,
      after,
      prNumber: null
    };
  }

  const prs = Array.isArray(associatedPrs) ? associatedPrs : [];
  const mergedPr = prs.find(
    pr =>
      Boolean(pr?.merged_at) &&
      String(pr?.base?.ref || "") === "main"
  );

  if (!mergedPr) {
    return {
      authorized: false,
      reason: "direct_main_push",
      before,
      after,
      prNumber: null
    };
  }

  const successes = successfulCheckNames(checkRuns);
  const missing = REQUIRED_MAIN_CHECKS.filter(name => !successes.has(name));
  if (missing.length) {
    return {
      authorized: false,
      reason: "missing_or_failed_checks:" + missing.join(","),
      before,
      after,
      prNumber: Number(mergedPr.number || 0) || null
    };
  }

  return {
    authorized: true,
    reason: "merged_pr_with_required_checks",
    before,
    after,
    prNumber: Number(mergedPr.number || 0) || null
  };
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

async function main() {
  const eventPath = argValue("--event");
  const prsPath = argValue("--prs");
  const checksPath = argValue("--checks");
  if (!eventPath || !prsPath || !checksPath) {
    throw new Error("guard_evidence_paths_required");
  }

  const [event, associatedPrs, checkRuns] = await Promise.all([
    readFile(eventPath, "utf8").then(JSON.parse),
    readFile(prsPath, "utf8").then(JSON.parse),
    readFile(checksPath, "utf8").then(JSON.parse)
  ]);

  const decision = classifyMainPush({ event, associatedPrs, checkRuns });
  const fields = {
    authorized: decision.authorized ? "true" : "false",
    reason: decision.reason,
    before: decision.before,
    after: decision.after,
    pr_number: decision.prNumber == null ? "" : String(decision.prNumber)
  };

  for (const [key, value] of Object.entries(fields)) {
    const safe = String(value).replace(/[\r\n]/g, " ");
    process.stdout.write(`${key}=${safe}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
