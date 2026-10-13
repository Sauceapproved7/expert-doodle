import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDiff} from '../scripts/hercules-independent-review.mjs';

const patch = (path, added) => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -3,0 +4,${added.length} @@\n${added.map(s => '+' + s).join('\n')}\n`;

test('records evidence fingerprint without exposing code or tokens', () => {
  const secret = 'SECRET_DO_NOT_OUTPUT_XYZ';
  const report = analyzeDiff(patch('app/server.mjs', [`process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ${secret}`]));
  assert.equal(report.engine, 'deterministic-offline');
  assert.equal(report.externalRequests, 0);
  assert.match(report.diffSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.findings[0].rule, 'tls-verification-disabled');
  assert.equal(report.findings[0].line, 4);
  assert.ok(!JSON.stringify(report).includes(secret));
});

test('flags GitHub workflow permissions and owner-controlled paths', () => {
  const report = analyzeDiff(patch('.github/workflows/risky.yml', ['permissions: write-all']));
  assert.ok(report.findings.some(x => x.rule === 'workflow-broad-permission'));
  assert.ok(report.findings.some(x => x.rule === 'sensitive-surface-review'));
});

test('retains a clean read-only result for safe changes', () => {
  const report = analyzeDiff(patch('docs/update.md', ['# A safe change']));
  assert.equal(report.status, 'reviewed');
  assert.deepEqual(report.findings, []);
  assert.equal(report.filesReviewed, 1);
});

test('rejects excess evidence instead of silently truncating', () => {
  assert.throws(() => analyzeDiff('x'.repeat(2_000_001)), /exceeds limit/);
});

test('reports binary diffs as uninspected, not clean', () => {
  const binary = 'diff --git a/assets/logo.png b/assets/logo.png\nBinary files a/assets/logo.png and b/assets/logo.png differ\n';
  const report = analyzeDiff(binary);
  assert.equal(report.status, 'incomplete');
  assert.ok(report.findings.some(x => x.rule === 'binary-not-reviewed'));
});

test('does not echo unsafe file paths from an untrusted patch', () => {
  const report = analyzeDiff(patch('bad<svg onload=alert(1)>.mjs', ['eval(userInput)']));
  assert.ok(!JSON.stringify(report).includes('<svg'));
});

test('caps findings and marks incomplete when cap is exceeded', () => {
  const report = analyzeDiff(patch('src/a.js', Array(120).fill('eval(input)')));
  assert.equal(report.status, 'incomplete');
  assert.ok(report.findings.length <= 100);
});

// Integration tests use an isolated temporary git repository and no network.
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';

function inScratchRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hercules-review-'));
  const git = (...args) => execFileSync('git', args, {cwd: dir, encoding: 'utf8'}).trim();
  try {
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Hercules Test');
    writeFileSync(join(dir, 'app.js'), 'export const hello = 1;\n');
    git('add', '.'); git('commit', '-qm', 'baseline');
    const baseSha = git('rev-parse', 'HEAD');
    writeFileSync(join(dir, 'app.js'), "export const hello = 1;\nprocess.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';\n");
    git('add', '.'); git('commit', '-qm', 'change');
    return fn(dir, baseSha);
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

test('CLI reviews a bounded local git diff with SHA-bound evidence', () => {
  inScratchRepo((cwd, baseSha) => {
    const diff = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', baseSha, 'HEAD'], {cwd, encoding: 'utf8'});
    const result = spawnSync(process.execPath, [new URL('../scripts/hercules-independent-review.mjs', import.meta.url).pathname], {
      cwd, input: diff, encoding: 'utf8', env: {...process.env, HERCULES_REVIEW_BASE_SHA: baseSha},
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'reviewed');
    assert.ok(report.findings.some(x => x.rule === 'tls-verification-disabled'));
  });
});

test('CLI fails closed when base SHA is unavailable', () => {
  const result = spawnSync(process.execPath, [new URL('../scripts/hercules-independent-review.mjs', import.meta.url).pathname], {
    encoding: 'utf8', env: {...process.env, HERCULES_REVIEW_BASE_SHA: ''},
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /independent_review_unavailable/);
});

test('CLI accepts a streamed diff without access to a git executable', () => {
  const result = spawnSync(process.execPath, [new URL('../scripts/hercules-independent-review.mjs', import.meta.url).pathname], {
    cwd: tmpdir(),
    input: patch('app/index.mjs', ["eval(userInput)"]),
    encoding: 'utf8',
    env: {...process.env, HERCULES_REVIEW_BASE_SHA: 'a'.repeat(40), PATH: '/nonexistent'},
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).findings.some(x => x.rule === 'dynamic-code-execution'));
});
