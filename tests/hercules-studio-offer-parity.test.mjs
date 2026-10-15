import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { studioOfferParityTargets, witnessStudioOffer } from '../hercules-runtime/studio-offer-parity.mjs';

const sourceHtml = '<!doctype html><main id="main"><label for="email">Email</label>No payment is collected /functions/v1/hercules-launch software_access_request</main>';
const html = body => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

test('two fixed, public HTTPS origins and no arbitrary destination input', () => {
  const targets = studioOfferParityTargets();
  assert.deepEqual(Object.keys(targets), ['storage', 'render']);
  assert.match(targets.storage, /^https:\/\/xbwuablxhhwsaoomsoco\.supabase\.co\/storage\/v1\/object\/public\/hercules-sites\//);
  assert.match(targets.render, /^https:\/\/sauceapproved-forge-host\.onrender\.com\/sauceapproved-studio-offer\/$/);
});

test('two matching public artifacts prove only exact bytes, never release authority or commerce readiness', async () => {
  const calls = [];
  const result = await witnessStudioOffer({ sourceHtml, fetchImpl: async (url, opts) => { calls.push({ url, opts }); return html(sourceHtml); } });
  assert.equal(result.exactPublicParityObserved, true);
  assert.equal(result.status, 'exact_public_bytes_observed');
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentVerified, false);
  assert.equal(result.leadDeliveryVerified, false);
  assert.deepEqual(result.authority, { publish: false, approve: false, charge: false });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ opts }) => opts.method === 'GET' && opts.redirect === 'manual' && opts.credentials === 'omit' && !('authorization' in opts.headers)));
});

test('drift at one origin fails closed even when the other matches', async () => {
  let n = 0;
  const result = await witnessStudioOffer({ sourceHtml, fetchImpl: async () => html(n++ ? 'old version' : sourceHtml) });
  assert.equal(result.exactPublicParityObserved, false);
  assert.deepEqual(result.observations.map(o => o.result), ['matching', 'different']);
  assert.equal(result.status, 'unverified_or_drifted');
});

test('HTTP redirects and content type mismatches cannot prove parity', async () => {
  let n = 0;
  const result = await witnessStudioOffer({ sourceHtml, fetchImpl: async () => n++ ? new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }) : new Response(null, { status: 302, headers: { location: 'https://other.example/' } }) });
  assert.equal(result.exactPublicParityObserved, false);
  assert.deepEqual(result.observations.map(o => o.reason), ['unexpected_http_status', 'unexpected_content_type']);
});

test('non-HTML storage responses reveal only bounded byte digests, never falsely pass parity', async () => {
  let calls = 0;
  const result = await witnessStudioOffer({
    sourceHtml,
    fetchImpl: async () => calls++ === 0
      ? new Response(sourceHtml, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
      : html(sourceHtml),
  });
  assert.equal(result.exactPublicParityObserved, false);
  assert.equal(result.observations[0].result, 'not_verified');
  assert.equal(result.observations[0].reason, 'unexpected_content_type');
  assert.equal(result.observations[0].exactBytesMatch, true);
  assert.equal(result.observations[0].observedSha256, result.sourceSha256);
  assert.equal(result.observations[0].bytes, Buffer.byteLength(sourceHtml, 'utf8'));
  assert.equal(result.observations[0].htmlContentType, false);
  assert.equal(result.observations[1].result, 'matching');
  assert.equal(result.releaseAuthorized, false);
});

test('outdated generic-mime storage object proves drift by hash without exposing old HTML', async () => {
  const oldHtml = '<!doctype html><h1>Previous Studio offer</h1>';
  let calls = 0;
  const result = await witnessStudioOffer({
    sourceHtml,
    fetchImpl: async () => calls++ === 0
      ? new Response(oldHtml, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
      : html(oldHtml),
  });
  assert.equal(result.exactPublicParityObserved, false);
  assert.equal(result.observations[0].reason, 'unexpected_content_type');
  assert.equal(result.observations[0].exactBytesMatch, false);
  assert.equal(result.observations[0].bytes, Buffer.byteLength(oldHtml, 'utf8'));
  assert.equal(result.observations[1].result, 'different');
  assert.equal(result.observations[1].exactBytesMatch, false);
  assert.equal(JSON.stringify(result).includes('Previous Studio offer'), false);
});

test('oversized bodies and remote exceptions are sanitized and never copied to reports', async () => {
  let n = 0;
  const result = await witnessStudioOffer({ sourceHtml, fetchImpl: async () => { if (n++ === 0) return html('z'.repeat(70_000)); throw new Error('secret-do-not-echo'); } });
  assert.equal(result.exactPublicParityObserved, false);
  assert.deepEqual(result.observations.map(o => o.reason), ['fetch_or_body_failed', 'fetch_or_body_failed']);
  assert.equal(JSON.stringify(result).includes('secret-do-not-echo'), false);
  assert.equal(JSON.stringify(result).includes('zzzzzzzz'), false);
});

test('invalid source HTML fails before any request', async () => {
  let calls = 0;
  await assert.rejects(witnessStudioOffer({ sourceHtml: '<html>incomplete</html>', fetchImpl: async () => { calls++; return html(sourceHtml); } }), /source_contract_not_met/);
  assert.equal(calls, 0);
});

test('CLI requires explicit --probe and rejects arbitrary options', () => {
  const cli = fileURLToPath(new URL('../scripts/hercules-studio-offer-parity.mjs', import.meta.url));
  for (const args of [[], ['--url', 'https://example.com'], ['--probe', '--target', 'https://example.com/']]) {
    const p = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(p.status, 2);
    assert.match(p.stderr, /explicit_probe_required/);
  }
});

test('CI browser audit never accepts wildcard origins and never deploys', () => {
  const workflow = readFileSync(new URL('../.github/workflows/hercules-studio-offer-public-artifact-audit.yml', import.meta.url), 'utf8');
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /allowOrigin === origin/);
  assert.doesNotMatch(workflow, /allowOrigin === ['"]\*['"]/);
  assert.match(workflow, /method: 'OPTIONS'/);
  assert.match(workflow, /customerSubmissionPerformed: false/);
  assert.doesNotMatch(workflow, /method: 'POST'|supabase db|deploy[_-]static|storage\.from\(/);
});

test('rollback capture retries only temporary Forge cold-start responses with a strict attempt bound', () => {
  const workflow = readFileSync(new URL('../.github/workflows/hercules-studio-offer-public-artifact-audit.yml', import.meta.url),'utf8');
  assert.match(workflow, /for\s*\(const attempt of \[1,2,3\]\)/);
  assert.match(workflow, /response\.status !== 503/);
  assert.match(workflow, /legacy_offer_html_not_available/);
  assert.match(workflow, /legacy_object_changed_no_backup/);
  assert.match(workflow, /expectedLegacy/);
});
