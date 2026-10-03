import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const workflowDir = new URL("../.github/workflows/", import.meta.url);
const releaseOnly = new Set([
  "hercules-cleaner-release-package.yml",
  "hercules-smokescreen-release-package.yml",
  "hercules-cleaner-windows-installer.yml",
  "hercules-release-evidence.yml"
]);

const workflows = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml"));

test("fork PR workflows are never privileged, secret-bearing, or pull_request_target workflows", async () => {
  for (const name of workflows) {
    const source = await readFile(join(workflowDir.pathname, name), "utf8");
    if (!/^\s*pull_request\s*:/m.test(source)) continue;

    assert.doesNotMatch(source, /^\s*pull_request_target\s*:/m, name);
    assert.doesNotMatch(source, /\$\{\{\s*secrets\.[^}]+\}\}/, name);
    assert.doesNotMatch(source, /^\s*id-token:\s*write\s*$/m, name);
    // A workflow may contain privileged jobs that are explicitly push-only.
    // Reject write permissions only when they are reachable from pull_request.
    const lines = source.split("\n");
    let pushOnlyJob = false;
    for (const line of lines) {
      if (/^  [A-Za-z0-9_-]+:\s*$/.test(line)) pushOnlyJob = false;
      if (/^    if:\s*.*github\.event_name\s*==\s*['"]push['"]/.test(line)) pushOnlyJob = true;
      if (!pushOnlyJob) {
        assert.doesNotMatch(line, /^\s*contents:\s*write\s*$/, name);
        assert.doesNotMatch(line, /^\s*packages:\s*write\s*$/, name);
        assert.doesNotMatch(line, /^\s*pull-requests:\s*write\s*$/, name);
      }
    }
    assert.doesNotMatch(source, /runs-on:\s*self-hosted/i, name);
  }
});

test("release/signing/package evidence workflows cannot execute from pull requests or manual dispatch", async () => {
  for (const name of releaseOnly) {
    const source = await readFile(join(workflowDir.pathname, name), "utf8");
    assert.doesNotMatch(source, /^\s*pull_request\s*:/m, name);
    assert.doesNotMatch(source, /^\s*workflow_dispatch\s*:/m, name);
    assert.match(source, /^\s*push:\s*$/m, name);
  }
});
