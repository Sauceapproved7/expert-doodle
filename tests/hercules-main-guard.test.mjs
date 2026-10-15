import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const REQUIRED = [
  "implementation-enforcement",
  "owner-code-only",
  "security-baseline",
  "codeql",
  "workflow-integrity",
  "provenance-attestation",
  "main-guard-contract"
];

async function guardModule() {
  return import("../scripts/hercules-main-guard.mjs");
}

test("main guard rejects direct pushes and incomplete PR evidence", async () => {
  const { classifyMainPush } = await guardModule();
  const direct = classifyMainPush({
    event:{before:"a",after:"b",sender:{login:"Sauceapproved7"},head_commit:{message:"direct"}},
    associatedPrs:[],
    checkRuns:{check_runs:[]}
  });
  assert.equal(direct.authorized,false);
  assert.equal(direct.reason,"direct_main_push");

  const failed = classifyMainPush({
    event:{before:"a",after:"b",sender:{login:"web-flow"},head_commit:{message:"merge"}},
    associatedPrs:[{merged_at:"2026-09-27T00:00:00Z",base:{ref:"main"},head:{sha:"prhead"}}],
    checkRuns:{check_runs:REQUIRED.slice(0,-1).map(name=>({name,status:"completed",conclusion:"success"}))}
  });
  assert.equal(failed.authorized,false);
  assert.match(failed.reason,/missing_or_failed_checks/);
});

test("main guard accepts a merged PR only when every required gate is green", async () => {
  const { classifyMainPush, REQUIRED_MAIN_CHECKS } = await guardModule();
  assert.deepEqual(REQUIRED_MAIN_CHECKS, REQUIRED);
  const decision = classifyMainPush({
    event:{before:"a",after:"b",sender:{login:"web-flow"},head_commit:{message:"merge"}},
    associatedPrs:[{number:99,merged_at:"2026-09-27T00:00:00Z",base:{ref:"main"},head:{sha:"prhead"}}],
    checkRuns:{check_runs:REQUIRED.map(name=>({name,status:"completed",conclusion:"success"}))}
  });
  assert.equal(decision.authorized,true);
  assert.equal(decision.reason,"merged_pr_with_required_checks");
  assert.equal(decision.prNumber,99);
});

test("runtime workflow can restore the previous tree without rewriting history", async () => {
  const workflow = await readFile(".github/workflows/hercules-main-integrity-guard.yml","utf8");
  assert.match(workflow,/push:[\s\S]*branches:[\s\S]*- main/);
  assert.match(workflow,/permissions:[\s\S]*contents:\s*read/);
  assert.match(workflow,/main-guard-runtime:[\s\S]*permissions:[\s\S]*contents:\s*write/);
  assert.match(workflow,/pull-requests:\s*read/);
  assert.match(workflow,/checks:\s*read/);
  assert.match(workflow,/if:\s*always\(\)[\s\S]*github\.event_name == 'push'/);
  assert.match(workflow,/git commit-tree/);
  assert.match(workflow,/CURRENT[\s\S]*AFTER/);
  assert.match(workflow,/main-guard-contract/);
  assert.match(workflow,/for attempt in \$\(seq 1 12\)/);
  assert.match(workflow,/required_check_evidence_not_ready/);
  assert.match(workflow,/sleep 5/);
});

test("native GitHub protection will require the main-guard contract too", async () => {
  const source = await readFile("supabase/functions/hercules-github-app/index.ts","utf8");
  assert.match(source,/main-guard-contract/);
});

test("merged pull request without the universal completeness-admission check must fail closed", async () => {
  const { classifyMainPush } = await guardModule();
  const decision = classifyMainPush({
    event: { before: "a", after: "b", sender: { login: "web-flow" }, head_commit: { message: "merge" } },
    associatedPrs: [{ number: 1080, merged_at: "2026-10-15T08:01:00Z", base: { ref: "main" }, head: { sha: "head" } }],
    checkRuns: { check_runs: REQUIRED.map(name => ({ name, status: "completed", conclusion: "success" })) }
  });
  assert.equal(decision.authorized, false);
  assert.match(decision.reason, /universal-merge-gates/);
});

test("runtime and native protection must require the universal completeness-admission check", async () => {
  const workflow = await readFile(".github/workflows/hercules-main-integrity-guard.yml", "utf8");
  const provider = await readFile("supabase/functions/hercules-github-app/index.ts", "utf8");
  const { REQUIRED_MAIN_CHECKS } = await guardModule();
  assert.ok(REQUIRED_MAIN_CHECKS.includes("universal-merge-gates"));
  assert.match(workflow, /required_checks=\([\s\S]*?"universal-merge-gates"/);
  const checks = provider.match(/const REQUIRED_MAIN_CHECKS = \[([\s\S]*?)\];/);
  assert.ok(checks, "GitHub App main protection check list must exist");
  assert.match(checks[1], /'universal-merge-gates'/);
});
