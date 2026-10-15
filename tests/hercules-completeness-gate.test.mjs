import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { evaluateCompletion, REQUIRED_PHASES } from "../scripts/hercules-completeness-gate.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "hercules-complete-"));
  try {
    await writeFile(join(root, "proof.txt"), "independently reviewed proof\n");
    const manifest = {
      schema: "sauceapproved.hercules.completion-evidence",
      version: 1,
      title: "Example Hercules change",
      intendedOutcome: "A tested and documented change",
      scope: "source-only",
      research: [{ question: "What exists?", finding: "Existing implementation reused", evidencePaths: ["proof.txt"] }],
      acceptance: [{ id: "A1", requirement: "Existing behavior preserved", status: "verified", evidencePaths: ["proof.txt"] }],
      phases: REQUIRED_PHASES.map((id) => ({
        id,
        status: id === "release" ? "not_applicable" : "verified",
        ...(id === "release" ? { reason: "Source-only change; no live deployment is part of this request" } : { evidencePaths: ["proof.txt"] })
      })),
      openThreads: []
    };
    await run(root, manifest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("complete evidenced scope passes with no unclosed threads", async () => {
  await fixture(async (root, manifest) => {
    const report = await evaluateCompletion(manifest, root);
    assert.equal(report.ready, true, report.errors.join("\n"));
    assert.equal(report.errors.length, 0);
  });
});

test("missing required phase fails closed", async () => {
  await fixture(async (root, manifest) => {
    manifest.phases.pop();
    assert.equal((await evaluateCompletion(manifest, root)).ready, false);
  });
});

test("unverified tests and unresolved dependencies cannot be marked complete", async () => {
  await fixture(async (root, manifest) => {
    manifest.phases.find((phase) => phase.id === "tests").status = "unverified";
    manifest.openThreads.push("Production permission missing");
    const report = await evaluateCompletion(manifest, root);
    assert.equal(report.ready, false);
    assert.ok(report.errors.some((e) => e.includes("tests")));
    assert.ok(report.errors.some((e) => e.includes("openThreads")));
  });
});

test("rejects claimed verification without an existing local evidence file", async () => {
  await fixture(async (root, manifest) => {
    manifest.acceptance[0].evidencePaths = ["nonexistent.txt"];
    assert.equal((await evaluateCompletion(manifest, root)).ready, false);
  });
});

test("rejects path traversal and absolute evidence paths", async () => {
  await fixture(async (root, manifest) => {
    manifest.acceptance[0].evidencePaths = ["../outside.txt", "/etc/passwd"];
    const report = await evaluateCompletion(manifest, root);
    assert.equal(report.ready, false);
    assert.ok(report.errors.some((e) => e.includes("unsafe")));
  });
});

test("not-applicable requires a documented reason and cannot waive tests for code", async () => {
  await fixture(async (root, manifest) => {
    manifest.phases.find((p) => p.id === "tests").status = "not_applicable";
    manifest.phases.find((p) => p.id === "tests").reason = "Not needed";
    assert.equal((await evaluateCompletion(manifest, root)).ready, false);
  });
});

test("duplicate phase and acceptance identifiers fail closed", async () => {
  await fixture(async (root, manifest) => {
    manifest.phases.push({ ...manifest.phases[0] });
    manifest.acceptance.push({ ...manifest.acceptance[0] });
    const report = await evaluateCompletion(manifest, root);
    assert.equal(report.ready, false);
    assert.ok(report.errors.some((e) => e.includes("duplicate")));
  });
});

test("command-line mode gives failing status for an unready manifest", async () => {
  await fixture(async (root, manifest) => {
    manifest.openThreads = ["Missing external approval"];
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    const result = spawnSync(process.execPath, ["scripts/hercules-completeness-gate.mjs", "--manifest", join(root, "manifest.json"), "--root", root, "--require-complete"], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"ready": false/);
  });
});
