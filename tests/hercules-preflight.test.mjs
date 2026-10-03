import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../scripts/hercules-preflight.mjs", import.meta.url), "utf8").catch(() => "");

test("Hercules preflight runs the mandatory local merge checks", () => {
  for (const required of [
    "tests/hercules-implementation-enforcement.test.mjs",
    "scripts/verify-hercules-execution-contract.mjs",
    "scripts/verify-owner-code-only.mjs",
    "scripts/security-baseline.mjs",
    "scripts/verify-workflow-files.mjs",
    "scripts/secret-scan.mjs",
  ]) {
    assert.ok(source.includes(required), "missing " + required);
  }
});

test("Hercules preflight is owner-code and fail-closed", () => {
  assert.match(source, /node:child_process/);
  assert.match(source, /process\.execPath/);
  assert.match(source, /status !== 0/);
  assert.match(source, /return false/);
  assert.doesNotMatch(source, /shell\s*:\s*true/);
});
