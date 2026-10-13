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


test('Codex Doctor flags agent, verifier, runtime and hosting control paths for review', () => {
  for (const path of [
    '.agents/skills/hercules-codex-operator/SKILL.md', '.github/dependabot.yml',
    '.devcontainer/devcontainer.json', '.vscode/settings.json', '.mcp.json',
    '.gitignore', 'Dockerfile', 'package.json', 'package-lock.json',
    'scripts/hercules-preflight.mjs', 'hercules-runtime/codex-readiness.mjs',
    'render/service.yaml', 'infra/network.tf', 'hercules-identity/auth.mjs',
    'shopify/theme.liquid', 'hercules-models/service.mjs',
  ]) {
    const result = assessProposedPaths([path]);
    assert.equal(result.paths[0].risk, 'review_required', path);
    assert.equal(result.authorizesChanges, false);
  }
});

test('Codex Doctor blocks ambiguous cross-platform path aliases and .git internals', () => {
  for (const path of [
    'C:relative.txt', 'docs/item:stream', '~/.ssh/id_rsa',
    'docs/%2e%2e/secrets', 'docs/%2Fetc', 'docs/%252e%252e',
    'docs/NUL.txt', 'docs/COM1', 'docs/trailing.', 'docs/trailing ',
    'docs/\u202Esecret', '.git/config', 'docs/.git/index',
    'docs/file%5c..%5csecret',
  ]) {
    const result = assessProposedPaths([path]);
    assert.equal(result.paths[0].risk, 'blocked', path);
    assert.equal(result.authorizesChanges, false);
  }
});

test('Codex Doctor protects other private key formats but leaves ordinary files isolated', () => {
  for (const path of [
    'credentials.pfx', 'data/key.pkcs12', 'config/secret.jks',
    'credentials.p8', 'vault/key.age', '.env.prod',
  ]) {
    assert.equal(assessProposedPaths([path]).paths[0].risk, 'review_required', path);
  }
  const result = assessProposedPaths(['docs/guide.md', 'tests/math.test.mjs']);
  assert.equal(result.status, 'isolated');
  assert.equal(result.authorizesChanges, false);
});
