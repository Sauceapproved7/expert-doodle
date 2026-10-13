import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REQUIRED_PATHS, assessProposedPaths, inspectReadiness } from '../hercules-runtime/codex-readiness.mjs';

const cli = fileURLToPath(new URL('../scripts/hercules-codex-doctor.mjs', import.meta.url));
const completeFiles = Object.fromEntries(REQUIRED_PATHS.map((path) => [path, true]));

function makeCheckout() {
  const dir = mkdtempSync(join(tmpdir(), 'hercules-codex-doctor-'));
  for (const path of REQUIRED_PATHS) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), 'fixture\n');
  }
  return dir;
}

test('local prerequisites never masquerade as cloud connection or executed checks', () => {
  const report = inspectReadiness({ files: completeFiles, nodeVersion: '22.16.0' });
  assert.equal(report.local.status, 'prerequisites_present');
  assert.equal(report.remote.status, 'unverified');
  assert.equal(report.checks.status, 'not_run');
  assert.equal(report.authority.productionDeployment, false);
  assert.equal(report.authority.commerce, false);
});

test('missing required file fails closed with evidence for the missing path', () => {
  const report = inspectReadiness({ files: { ...completeFiles, 'AGENTS.md': false }, nodeVersion: '22.16.0' });
  assert.equal(report.local.status, 'blocked');
  assert.deepEqual(report.local.missingPaths, ['AGENTS.md']);
});

test('Node version lower than 22 or malformed is a local blocker', () => {
  assert.equal(inspectReadiness({ files: completeFiles, nodeVersion: '20.19.0' }).local.status, 'blocked');
  assert.equal(inspectReadiness({ files: completeFiles, nodeVersion: 'unknown' }).local.status, 'blocked');
});

test('safe paths are distinct from protected governance, workflow, and commerce paths', () => {
  const result = assessProposedPaths(['docs/my-note.md', 'tests/my-feature.test.mjs', '.github/workflows/ci.yml', 'governance/policy.json', 'supabase/functions/payments/index.ts']);
  assert.equal(result.status, 'review_required');
  assert.deepEqual(result.paths.map(({ risk }) => risk), ['isolated', 'isolated', 'review_required', 'review_required', 'review_required']);
  assert.equal(result.authorizesChanges, false);
});

test('rejects traversal, absolute paths, malformed paths, and backslash traversal', () => {
  for (const path of ['../secrets', 'docs/../.env', '/etc/passwd', 'C:\\Windows\\file', 'a\\..\\secret', '', 'hello\nworld']) {
    const result = assessProposedPaths([path]);
    assert.equal(result.status, 'blocked', path);
    assert.equal(result.paths[0].risk, 'blocked', path);
  }
});

test('hidden dotenv files and deployment paths always require review', () => {
  const report = assessProposedPaths(['.env.local', 'src/.env.production', 'deploy/render-service.yaml', 'hercules-hurc/signer.mjs']);
  assert.equal(report.status, 'review_required');
  assert.ok(report.paths.every((path) => path.risk === 'review_required'));
});

test('JSON CLI is read-only and explicitly reports unverifiable remote state', () => {
  const dir = makeCheckout();
  try {
    const run = spawnSync(process.execPath, [cli, '--json', '--changed', 'docs/upgrade.md'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, CODEX_ENVIRONMENT_ID: 'untrusted-claim' }
    });
    assert.equal(run.status, 0, run.stderr);
    const output = JSON.parse(run.stdout);
    assert.equal(output.local.status, 'prerequisites_present');
    assert.equal(output.remote.status, 'unverified');
    assert.equal(output.proposedChanges.status, 'isolated');
    assert.equal(output.checks.status, 'not_run');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI fails closed when required source markers are missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hercules-codex-missing-'));
  try {
    const run = spawnSync(process.execPath, [cli, '--json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(run.stdout).local.status, 'blocked');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unknown CLI flags are rejected without performing any checks', () => {
  const run = spawnSync(process.execPath, [cli, '--deploy'], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /unsupported option/i);
});
