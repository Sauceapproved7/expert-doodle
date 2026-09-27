import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourcePath = "supabase/functions/hercules-github-app/index.ts";

test("Hercules GitHub App requests repository administration permission", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /administration\s*:\s*['"]write['"]/);
  assert.match(source, /contents\s*:\s*['"]write['"]/);
  assert.match(source, /pull_requests\s*:\s*['"]write['"]/);
});

test("Hercules GitHub App enforces main protection server-side", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /async function enforceMainProtection\s*\(/);
  assert.match(source, /branches\/main\/protection/);
  assert.match(source, /method\s*:\s*['"]PUT['"]/);
  assert.match(source, /required_status_checks/);
  for (const check of [
    "implementation-enforcement",
    "owner-code-only",
    "security-baseline",
    "codeql",
    "workflow-integrity",
    "provenance-attestation"
  ]) {
    assert.match(source, new RegExp(check));
  }
  assert.match(source, /enforce_admins\s*:\s*true/);
  assert.match(source, /required_pull_request_reviews/);
  assert.match(source, /required_approving_review_count\s*:\s*0/);
  assert.match(source, /required_conversation_resolution\s*:\s*true/);
  assert.match(source, /allow_force_pushes\s*:\s*false/);
  assert.match(source, /allow_deletions\s*:\s*false/);
});

test("reconciliation persists branch-protection evidence", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /branchProtection\s*=\s*await enforceMainProtection/);
  assert.match(source, /branch_protection\s*:\s*branchProtection/);
  assert.match(source, /return\s*\{[^}]*branchProtection/s);
});
