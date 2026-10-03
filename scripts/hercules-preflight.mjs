import { spawnSync } from "node:child_process";

const checks = [
  ["Implementation enforcement tests", ["--test", "tests/hercules-implementation-enforcement.test.mjs"]],
  ["Execution contract", ["scripts/verify-hercules-execution-contract.mjs"]],
  ["Owner-code boundary", ["scripts/verify-owner-code-only.mjs"]],
  ["Security baseline", ["scripts/security-baseline.mjs"]],
  ["Workflow syntax", ["scripts/verify-workflow-files.mjs"]],
  ["Secrets scan", ["scripts/secret-scan.mjs"]],
];

export function runPreflight(run = spawnSync) {
  for (const [label, args] of checks) {
    process.stdout.write(`\n[Hercules preflight] ${label}\n`);
    const result = run(process.execPath, args, { stdio: "inherit" });
    if (result.error) {
      console.error(`[Hercules preflight] ${label} could not start:`, result.error.message);
      return false;
    }
    if (result.status !== 0) {
      console.error(`[Hercules preflight] ${label} failed with status ${result.status}`);
      return false;
    }
  }
  process.stdout.write("\n[Hercules preflight] all checks passed\n");
  return true;
}

if (!runPreflight()) process.exitCode = 1;
