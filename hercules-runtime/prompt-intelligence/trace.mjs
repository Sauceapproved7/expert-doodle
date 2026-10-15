import {createHmac, timingSafeEqual, createHash} from 'node:crypto';

const KINDS = new Set(['navigation', 'page_text', 'agent_message', 'tool_attempt']);
const MAX_BYTES = 65536;
const IDENTIFIER = /^[a-zA-Z0-9_-]{1,64}$/;

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function keysMatch(value, names) {
  return plain(value) && Object.keys(value).sort().join(',') === [...names].sort().join(',');
}
function normalize(event) {
  if (!plain(event) || !KINDS.has(event.kind)) throw new Error('invalid_event');
  if (event.kind === 'navigation') {
    if (!keysMatch(event, ['kind', 'url']) || typeof event.url !== 'string') throw new Error('invalid_navigation');
    return {kind: 'message', content: '[browser navigation: URL redacted]'};
  }
  if (event.kind === 'page_text' || event.kind === 'agent_message') {
    if (!keysMatch(event, ['kind', 'text']) || typeof event.text !== 'string') throw new Error('invalid_text');
    return {kind: 'message', content: event.text};
  }
  if (!keysMatch(event, ['kind', 'action', 'payload']) || typeof event.action !== 'string' || !plain(event.payload)) throw new Error('invalid_tool_attempt');
  return {kind: 'tool_attempt', action: event.action, allowed: false, reason: 'untrusted_browser_content'};
}

/**
 * Read-only receipt creation for a trusted Hercules Browser trace exporter.
 * Authentication proves emitter identity, never authorization to run tools.
 * The caller must provide an atomic durable replay claim operation.
 */
export async function ingestBrowserTrace(envelope, {keyForSource, claimSequence}) {
  if (!keysMatch(envelope, ['source', 'sequence', 'event', 'mac'])) throw new Error('invalid_envelope');
  const {source, sequence, event, mac} = envelope;
  if (typeof source !== 'string' || !IDENTIFIER.test(source) || !Number.isSafeInteger(sequence) || sequence < 1 || typeof mac !== 'string' || !/^[a-f0-9]{64}$/.test(mac)) throw new Error('invalid_envelope');
  const serialized = JSON.stringify({source, sequence, event});
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) throw new Error('oversized_or_invalid');
  const key = await keyForSource(source);
  if (!Buffer.isBuffer(key) || key.length < 32) throw new Error('untrusted_source');
  const actual = Buffer.from(mac, 'hex');
  const expected = createHmac('sha256', key).update(serialized).digest();
  if (!timingSafeEqual(actual, expected)) throw new Error('invalid_signature');
  const record = normalize(event);
  if (await claimSequence(source, sequence) !== true) throw new Error('replayed_event');
  return Object.freeze({source: 'browser:' + source, sequence, digest: createHash('sha256').update(serialized).digest('hex'), ...record});
}
