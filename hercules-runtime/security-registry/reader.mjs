import {createHash, timingSafeEqual} from 'node:crypto';

const SAFETY = new Set(['defensive', 'dual_use', 'hazardous_artifact']);
const MODES = new Set(['automatic', 'manual_review', 'metadata_only']);
const TRUST = new Set(['authoritative', 'community-vetted', 'dual-use']);
function https(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid source URL');
}

// Read-only catalog API: no network, execution, or filesystem authority.
export async function loadRegistry(input, expectedSha256) {
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('trusted checksum required');
  if (!(input instanceof Uint8Array) || input.byteLength > 4 * 1024 * 1024) throw new Error('bounded registry bytes required');
  const bytes = Buffer.from(input);
  const actual = createHash('sha256').update(bytes).digest();
  if (!timingSafeEqual(actual, Buffer.from(expectedSha256, 'hex'))) throw new Error('registry checksum mismatch');
  const data = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(data.sources) || data.sources.length > 10000 || data.source_count !== data.sources.length) throw new Error('invalid source count');
  if (typeof data.schema_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.schema_version)) throw new Error('invalid version');
  const records = new Map();
  for (const item of data.sources) {
    if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]+$/.test(item.id) || records.has(item.id)) throw new Error('invalid or duplicate source id');
    if (!SAFETY.has(item.safety) || !MODES.has(item.ingestion_mode) || !TRUST.has(item.trust_tier)) throw new Error('invalid source policy');
    if (typeof item.title !== 'string' || !Array.isArray(item.relationships)) throw new Error('invalid source metadata');
    https(item.url);
    if (item.alternate_urls !== undefined && !Array.isArray(item.alternate_urls)) throw new Error('invalid alternates');
    for (const url of item.alternate_urls ?? []) https(url);
    records.set(item.id, item);
  }
  for (const item of records.values()) {
    if (item.relationships.some(id => !records.has(id))) throw new Error('unknown relationship');
  }
  return Object.freeze({
    version: data.schema_version,
    count: records.size,
    checksum: expectedSha256,
    get(id) { return records.has(id) ? structuredClone(records.get(id)) : null; },
    search(query = '', {limit = 100, safety, trust} = {}) {
      if (typeof query !== 'string' || query.length > 1000 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('invalid search bounds');
      if (safety !== undefined && !SAFETY.has(safety) || trust !== undefined && !TRUST.has(trust)) throw new Error('invalid search filter');
      const needle = query.toLowerCase();
      return [...records.values()].filter(item => (!safety || item.safety === safety) && (!trust || item.trust_tier === trust) && JSON.stringify(item).toLowerCase().includes(needle)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit).map(item => structuredClone(item));
    },
    policy(id) {
      const item = records.get(id);
      if (!item) throw new Error('unknown source');
      return Object.freeze({metadataSearchAllowed: true, quarantined: item.safety === 'hazardous_artifact', automaticFetchAllowed: false, executionAllowed: false});
    }
  });
}
