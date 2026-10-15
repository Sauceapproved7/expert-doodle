import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { assessPullRequest } from "../scripts/hercules-pr-completeness-admission.mjs";

const START = "2026-10-15T00:00:00Z";
const REPO = "Sauceapproved7/expert-doodle";
const EVIDENCE = ".hercules/completion-evidence/pr-admission.json";
const CHANGES = ["scripts/hercules-pr-completeness-admission.mjs", "tests/hercules-pr-completeness-admission.test.mjs", "docs/HERCULES-PR-COMPLETENESS-ADMISSION-V1.md", EVIDENCE];

async function withFixture(run) {
  const root = await mkdtemp(join(process.cwd(), "hercules-pr-admission-test-"));
  async function put(path, data = "Evidence for Hercules\\n") {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), data);
  }
  try {
    for (const file of CHANGES.filter((p) => p !== EVIDENCE)) await put(file);
    const manifest = {
      schema: "sauceapproved.hercules.completion-evidence",
      version: 1,
      title: "PR completeness admission",
      intendedOutcome: "Merge with closure evidence",
      scope: "source-only",
      changedFiles: CHANGES,
      research: [{ question: "What exists already?", finding: "Existing Hercules merge gates will be reused", evidencePaths: ["docs/HERCULES-PR-COMPLETENESS-ADMISSION-V1.md"] }],
      acceptance: [{ id: "A1", requirement: "Missing completion manifests are rejected", status: "verified", evidencePaths: ["tests/hercules-pr-completeness-admission.test.mjs"] }],
      phases: ["research", "design", "implementation", "tests", "security", "documentation", "release", "verification"].map((id) => (
        id === "release"
          ? { id, status: "not_applicable", reason: "This source-only change does not include a production or staging deployment" }
          : { id, status: "verified", evidencePaths: [id === "documentation" || id === "research" || id === "design" ? "docs/HERCULES-PR-COMPLETENESS-ADMISSION-V1.md" : id === "implementation" ? "scripts/hercules-pr-completeness-admission.mjs" : "tests/hercules-pr-completeness-admission.test.mjs"] }
      )),
      openThreads: []
    };
    await put(EVIDENCE, JSON.stringify(manifest, null, 2));
    await run({
      root, manifest, put,
      args: {
        createdAt: "2026-10-15T08:00:00Z",
        cutoff: START,
        repo: REPO,
        changedFiles: CHANGES,
        root
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("new material PR without a completion manifest is blocked", async () => {
  await withFixture(async ({ args }) => {
    args.changedFiles = ["scripts/new-feature.mjs"];
    const result = await assessPullRequest(args);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("completion manifest")));
  });
});

test("new material PR with complete scoped evidence passes admission", async () => {
  await withFixture(async ({ args }) => {
    const result = await assessPullRequest(args);
    assert.equal(result.ok, true, result.errors.join("\\n"));
    assert.equal(result.required, true);
  });
});

test("new material PR with incomplete file inventory is blocked", async () => {
  await withFixture(async ({ args, manifest, put }) => {
    manifest.changedFiles = CHANGES.slice(1);
    await put(EVIDENCE, JSON.stringify(manifest));
    const result = await assessPullRequest(args);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("inventory")));
  });
});

test("adding only documentation does not require an evidence manifest", async () => {
  await withFixture(async ({ args }) => {
    args.changedFiles = ["README.md", "docs/PLATFORM-GUIDE.md"];
    const result = await assessPullRequest(args);
    assert.equal(result.ok, true, result.errors.join("\\n"));
    assert.equal(result.required, false);
  });
});

test("workflow changes are material and require a manifest", async () => {
  await withFixture(async ({ args }) => {
    args.changedFiles = [".github/workflows/hercules-implementation-enforcement.yml"];
    const result = await assessPullRequest(args);
    assert.equal(result.ok, false);
    assert.equal(result.required, true);
  });
});

test("pre-adoption PRs are grandfathered without a manifest", async () => {
  await withFixture(async ({ args }) => {
    args.createdAt = "2026-10-14T23:59:59Z";
    args.changedFiles = ["scripts/new-feature.mjs"];
    const result = await assessPullRequest(args);
    assert.equal(result.ok, true);
    assert.equal(result.reason, "predates_policy");
  });
});

test("malformed timestamps, missing event context and suspicious paths fail closed", async () => {
  await withFixture(async ({ args }) => {
    args.createdAt = "yesterday";
    let result = await assessPullRequest(args);
    assert.equal(result.ok, false);
    args.createdAt = "2026-10-15T08:00:00Z";
    args.changedFiles = ["../evil.js"];
    result = await assessPullRequest(args);
    assert.equal(result.ok, false);
  });
});

test("an unverified acceptance criterion blocks admission", async () => {
  await withFixture(async ({ args, manifest, put }) => {
    manifest.acceptance[0].status = "unverified";
    await put(EVIDENCE, JSON.stringify(manifest));
    const result = await assessPullRequest(args);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("acceptance")));
  });
});

test("a recycled unchanged manifest cannot authorize a new material PR", async () => {
  await withFixture(async ({ args }) => {
    args.changedFiles = ["scripts/new-feature.mjs", "tests/new-feature.test.mjs"];
    const result = await assessPullRequest(args);
    assert.equal(result.ok, false);
  });
});
