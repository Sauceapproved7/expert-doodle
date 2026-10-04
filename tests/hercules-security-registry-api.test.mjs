import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createForgeControlService} from '../hercules-forge/control-api.mjs';

test('operator registry API is authenticated, bounded, and read-only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'registry-api-'));
  const token = ['registry', 'operator', 'test', 'fixture'].join('-');
  const server = createForgeControlService({root, token});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/v1/security/registry`;
  const headers = {authorization: `Bearer ${token}`};
  try {
    assert.equal((await fetch(base)).status, 401);
    const response = await fetch(base + '?q=CISA', {headers});
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.registryVersion, '1.3.3');
    assert.equal(result.sourceCount, 21);
    assert.equal(result.executionAuthority, false);
    assert.equal(result.automaticFetchAllowed, false);
    assert.ok(result.sources.some(x => x.id === 'cisa-kev'));
    const hazardous = await (await fetch(base + '?id=malwarebazaar', {headers})).json();
    assert.equal(hazardous.policy.quarantined, true);
    assert.equal(hazardous.policy.automaticFetchAllowed, false);
    assert.equal((await fetch(base + '?id=missing', {headers})).status, 404);
    assert.equal((await fetch(base + '?url=https://example.com', {headers})).status, 400);
    assert.equal((await fetch(base + '?limit=1001', {headers})).status, 400);
    assert.equal((await fetch(base + '?q=a&q=b', {headers})).status, 400);
    assert.equal((await fetch(base, {headers, method: 'POST'})).status, 405);
    assert.equal((await fetch(base, {method: 'POST'})).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
