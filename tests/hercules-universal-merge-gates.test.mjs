import "./hercules-owner-code-container-images.test.mjs";
import "./hercules-staging-runtime-patch-levels.test.mjs";
import "./hercules-founding-pilot-admission.test.mjs";
import "./hercules-soundworld-launch-gift.test.mjs";
import "./hercules-soundworld-gift-backend-ledger.test.mjs";
import "./hercules-launch-gate-freshness.test.mjs";
import "./hercules-paid-launch-payment-gate.test.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflows = [
  ".github/workflows/hercules-security-baseline.yml",
  ".github/workflows/hercules-workflow-syntax-gate.yml"
];

for (const path of workflows) {
  test(`${path} runs for every pull request and main push`, async () => {
    const source = await readFile(path, "utf8");
    assert.match(source, /pull_request:\s*(?:\n|$)/);
    assert.match(source, /push:\s*\n\s+branches:\s*\n\s+- main/);
    assert.doesNotMatch(source, /^\s+paths:\s*$/m);
  });
}
