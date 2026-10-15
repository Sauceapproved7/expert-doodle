/**
 * Read-only release parity witness. Exact public GET endpoints only; no credentials,
 * redirects, writes, buyer data, release approval, or arbitrary destination input.
 */
import { createHash } from 'node:crypto';

const TARGETS = Object.freeze({
  storage: 'https://xbwuablxhhwsaoomsoco.supabase.co/storage/v1/object/public/hercules-sites/ea5fb196-67f9-42fa-b592-49eeb3b84346/sauceapproved-studio-offer/index.html',
  render: 'https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/',
});
const MAX_BYTES = 65536;
const TIMEOUT_MS = 8000;
const sha256 = value => createHash('sha256').update(value).digest('hex');

export function studioOfferParityTargets() { return { ...TARGETS }; }

function validateSource(sourceHtml) {
  if (typeof sourceHtml !== 'string' || !sourceHtml.length || Buffer.byteLength(sourceHtml, 'utf8') > MAX_BYTES) {
    throw new TypeError('invalid_source_html');
  }
  const markers = [
    '<main id="main">',
    '<label for="email">',
    'No payment is collected',
    '/functions/v1/hercules-launch',
    'software_access_request',
  ];
  if (!markers.every(marker => sourceHtml.includes(marker))) throw new TypeError('source_contract_not_met');
}

async function boundedBody(response) {
  if (!response?.body || typeof response.body.getReader !== 'function') throw new Error('body_missing');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('invalid_body_chunk');
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('body_too_large');
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    try { await reader.cancel(); } catch { /* no remote content disclosure */ }
  }
}

async function observeOne(surface, url, expectedSha, fetchImpl) {
  let status = null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'manual',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { accept: 'text/html' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = Number.isInteger(response?.status) ? response.status : null;
    if (status !== 200 || response.redirected === true) {
      return { surface, result: 'not_verified', reason: 'unexpected_http_status', httpStatus: status };
    }
    const htmlContentType = /^text\/html(?:\s*;|\s*$)/i.test(response.headers?.get('content-type') ?? '');
    const declaredLength = response.headers?.get('content-length');
    if (declaredLength && Number(declaredLength) > MAX_BYTES) {
      return { surface, result: 'not_verified', reason: 'body_too_large', httpStatus: status };
    }
    const body = await boundedBody(response);
    const observedSha256 = sha256(body);
    const exactBytesMatch = observedSha256 === expectedSha;
    return {
      surface,
      result: htmlContentType ? (exactBytesMatch ? 'matching' : 'different') : 'not_verified',
      reason: htmlContentType ? (exactBytesMatch ? 'exact_bytes_observed' : 'source_bytes_differ') : 'unexpected_content_type',
      httpStatus: status,
      observedSha256,
      bytes: body.byteLength,
      exactBytesMatch,
      htmlContentType,
    };
  } catch {
    return { surface, result: 'not_verified', reason: 'fetch_or_body_failed', httpStatus: status };
  }
}

export async function witnessStudioOffer({ sourceHtml, fetchImpl = fetch } = {}) {
  validateSource(sourceHtml);
  if (typeof fetchImpl !== 'function') throw new TypeError('invalid_fetch_dependency');
  const sourceSha256 = sha256(Buffer.from(sourceHtml, 'utf8'));
  const observations = [];
  for (const [surface, url] of Object.entries(TARGETS)) {
    observations.push(await observeOne(surface, url, sourceSha256, fetchImpl));
  }
  const exactPublicParityObserved = observations.length === 2 && observations.every(o => o.result === 'matching');
  return {
    schema: 'sauceapproved.hercules.studio-offer-parity.v1',
    sourcePath: 'hercules-forge/offers/sauceapproved-studio/index.html',
    sourceSha256,
    targets: studioOfferParityTargets(),
    observations,
    exactPublicParityObserved,
    status: exactPublicParityObserved ? 'exact_public_bytes_observed' : 'unverified_or_drifted',
    authenticatedApplicationVerified: false,
    leadDeliveryVerified: false,
    paymentVerified: false,
    releaseAuthorized: false,
    authority: { publish: false, approve: false, charge: false },
  };
}
