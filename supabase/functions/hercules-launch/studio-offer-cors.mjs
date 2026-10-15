/**
 * Only the public Studio founding-access offer is granted cross-origin
 * JSON intake visibility. This is not authentication or a release gate.
 * All other Hercules launch endpoints keep their existing policy.
 */
const OFFER_ORIGIN = 'https://sauceapproved-forge-host.onrender.com';
const VARY = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';
const DENY_HEADERS = Object.freeze({
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'vary':VARY,
});

export function studioOfferPreflight(req) {
  if (req.method !== 'OPTIONS') return null;
  const origin = req.headers.get('origin') ?? '';
  const method = req.headers.get('access-control-request-method') ?? '';
  const requested = (req.headers.get('access-control-request-headers') ?? '')
    .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if (origin !== OFFER_ORIGIN || method !== 'POST' ||
      requested.length !== 1 || requested[0] !== 'content-type') {
    return Response.json({error:'cors_preflight_not_allowed'},{
      status:403,headers:DENY_HEADERS,
    });
  }
  return new Response(null,{
    status:204,
    headers:{
      ...DENY_HEADERS,
      'access-control-allow-origin':OFFER_ORIGIN,
      'access-control-allow-methods':'POST',
      'access-control-allow-headers':'content-type',
    },
  });
}

export function studioOfferCorsResponse(req,response) {
  if(req.headers.get('origin') !== OFFER_ORIGIN) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin',OFFER_ORIGIN);
  const vary = headers.get('vary');
  headers.set('vary',vary ? vary + ', Origin' : 'Origin');
  headers.set('cache-control','no-store');
  headers.set('x-content-type-options','nosniff');
  // Do not set Access-Control-Allow-Credentials or wildcard origins.
  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers,
  });
}
