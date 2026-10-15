import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  studioOfferPreflight,
  studioOfferResponseHeaders,
} from '../supabase/functions/hercules-launch/studio-offer-cors.mjs';

const allowedOrigin = 'https://sauceapproved-forge-host.onrender.com';
const endpoint = 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch';

const preflight = (origin=allowedOrigin, method='POST', headers='content-type') => new Request(endpoint, {
  method: 'OPTIONS',
  headers: {
    origin,
    'access-control-request-method': method,
    'access-control-request-headers': headers,
  },
});

test('exact Studio offer browser preflight admits only POST JSON from its existing presentation origin', () => {
  const response = studioOfferPreflight(preflight());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.match(response.headers.get('access-control-allow-methods') || '', /POST/);
  assert.equal(response.headers.get('access-control-allow-headers'), 'content-type');
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
});

test('unapproved origins, arbitrary headers, and other methods receive no CORS authorization', () => {
  for (const request of [
    preflight('https://attacker.example'),
    preflight('null'),
    preflight(allowedOrigin, 'DELETE'),
    preflight(allowedOrigin, 'GET'),
    preflight(allowedOrigin, 'POST', 'authorization, content-type'),
    preflight(allowedOrigin, 'POST', 'apikey'),
    preflight(allowedOrigin, 'POST', ''),
  ]) {
    assert.equal(studioOfferPreflight(request), null);
    assert.deepEqual(studioOfferResponseHeaders(request), request.headers.get('origin') === allowedOrigin
      ? { 'access-control-allow-origin': allowedOrigin, vary: 'Origin' }
      : {});
  }
});

test('browser POST success/error can share scoped CORS headers; no-origin calls remain unchanged', () => {
  const good = new Request(endpoint, { method: 'POST', headers: { origin: allowedOrigin } });
  const internal = new Request(endpoint, { method: 'POST' });
  assert.deepEqual(studioOfferResponseHeaders(good), {
    'access-control-allow-origin': allowedOrigin, vary: 'Origin',
  });
  assert.deepEqual(studioOfferResponseHeaders(internal), {});
  assert.equal(studioOfferPreflight(good), null);
  assert.equal(studioOfferPreflight(internal), null);
});

test('live handler uses scoped preflight and response headers exclusively on access-request action', () => {
  const source = readFileSync(new URL('../supabase/functions/hercules-launch/index.ts', import.meta.url), 'utf8');
  assert.match(source, /import\s+\{\s*studioOfferPreflight,\s*studioOfferResponseHeaders\s*\}\s+from\s+"\.\/studio-offer-cors\.mjs"/);
  assert.match(source, /const offerPreflight=studioOfferPreflight\(req\);if\(offerPreflight\)return offerPreflight;/);
  const action = source.slice(source.indexOf('if(action==="software_access_request")'));
  assert.match(action, /result\.body,\{status:result\.status,headers:\{[^}]*studioOfferResponseHeaders\(req\)/);
  assert.match(action, /error:detail\},\{status,headers:\{[^}]*studioOfferResponseHeaders\(req\)/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin.*\*/);
});
