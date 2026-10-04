import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadRegistry} from '../hercules-runtime/security-registry/reader.mjs';

const bytes = await readFile(new URL('../hercules-runtime/security-registry/security-registry.json', import.meta.url));
const digest = createHash('sha256').update(bytes).digest('hex');
test('requires an independently supplied matching checksum', async () => {
  await assert.rejects(loadRegistry(bytes, '0'.repeat(64)), /checksum/);
  await assert.rejects(loadRegistry(bytes), /checksum/);
});
test('search and lookup preserve official alternates', async () => {
  const reader = await loadRegistry(bytes, digest);
  assert.equal(reader.count, 21);
  assert.equal(reader.get('cisa-kev').alternate_urls[0], 'https://github.com/cisagov/kev-data');
  assert.ok(reader.search('CSAF').some(x => x.id === 'cisa-ics'));
  assert.equal(reader.get('missing'), null);
});
test('hazardous sources remain discoverable metadata but never fetch-eligible', async () => {
  const reader = await loadRegistry(bytes, digest);
  for (const source of reader.search('')) {
    const decision = reader.policy(source.id);
    assert.equal(decision.executionAllowed, false);
    if (source.safety === 'hazardous_artifact') {
      assert.equal(decision.quarantined, true);
      assert.equal(decision.automaticFetchAllowed, false);
    }
  }
});
test('caller mutation cannot alter registry policy', async () => {
  const reader = await loadRegistry(bytes, digest);
  const record = reader.get('malwarebazaar');
  record.safety = 'defensive';
  assert.equal(reader.policy('malwarebazaar').quarantined, true);
});
test('invalid relationships and duplicate IDs fail closed', async () => {
  for (const [mutate, error] of [[data => data.sources.push(data.sources[0]), /duplicate source id/], [data => data.sources[0].relationships.push('missing'), /unknown relationship/]]) {
    const data = JSON.parse(bytes);
    mutate(data);
    data.source_count = data.sources.length;
    const modified = Buffer.from(JSON.stringify(data));
    await assert.rejects(loadRegistry(modified, createHash('sha256').update(modified).digest('hex')), error);
  }
});
