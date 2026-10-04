import {readFile} from 'node:fs/promises';
import {loadRegistry} from './reader.mjs';

export const REGISTRY_SHA256 = 'ff0d36253fded3d809126a2d7539ae55f739adfc5609229acb3558f8e3a63eeb';
let pending;
function bundledRegistry() {
  pending ??= readFile(new URL('./security-registry.json', import.meta.url)).then(bytes => loadRegistry(bytes, REGISTRY_SHA256));
  return pending;
}
function badQuery() { return Object.assign(new Error('invalid registry query'), {statusCode: 400}); }

export async function querySecurityRegistry(params) {
  const allowed = new Set(['q', 'limit', 'safety', 'trust', 'id']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw badQuery();
  }
  const id = params.get('id');
  if (id !== null && (!/^[a-z0-9-]{1,100}$/.test(id) || [...params.keys()].some(key => key !== 'id'))) throw badQuery();
  const limitText = params.get('limit') ?? '100';
  if (!/^[1-9]\d{0,3}$/.test(limitText) || Number(limitText) > 1000 || (params.get('q') ?? '').length > 1000) throw badQuery();
  if (params.has('safety') && !['defensive', 'dual_use', 'hazardous_artifact'].includes(params.get('safety'))) throw badQuery();
  if (params.has('trust') && !['authoritative', 'community-vetted', 'dual-use'].includes(params.get('trust'))) throw badQuery();
  let reader;
  try { reader = await bundledRegistry(); }
  catch { throw Object.assign(new Error('registry unavailable'), {statusCode: 503}); }
  const common = {registryVersion: reader.version, registrySha256: reader.checksum, sourceCount: reader.count, executionAuthority: false, automaticFetchAllowed: false};
  if (id !== null) {
    const source = reader.get(id);
    if (!source) throw Object.assign(new Error('source not found'), {statusCode: 404});
    return {...common, source, policy: reader.policy(id)};
  }
  return {...common, sources: reader.search(params.get('q') ?? '', {limit: Number(limitText), safety: params.get('safety') ?? undefined, trust: params.get('trust') ?? undefined})};
}
