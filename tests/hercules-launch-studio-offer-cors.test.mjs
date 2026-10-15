import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  studioOfferPreflight,
  studioOfferCorsResponse,
} from '../supabase/functions/hercules-launch/studio-offer-cors.mjs';

const allowed = 'https://sauceapproved-forge-host.onrender.com';
const launchUrl = 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch';
const preflight = (origin=allowed, method='POST', headers='content-type') => new Request(launchUrl,{
  method:'OPTIONS',
  headers:{
    origin,
    'access-control-request-method':method,
    'access-control-request-headers':headers,
  },
});

test('Studio offer exact-origin JSON POST preflight succeeds without credentials or redirects', async()=>{
  const response=studioOfferPreflight(preflight());
  assert.equal(response.status,204);
  assert.equal(await response.text(),'');
  assert.equal(response.headers.get('access-control-allow-origin'),allowed);
  assert.equal(response.headers.get('access-control-allow-methods'),'POST');
  assert.equal(response.headers.get('access-control-allow-headers'),'content-type');
  assert.equal(response.headers.get('access-control-allow-credentials'),null);
  assert.match(response.headers.get('vary')??'',/origin/i);
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('preflight fails closed for unknown origins, null origins, methods or privileged request headers',()=>{
  for(const request of [
    preflight('https://evil.example'),
    preflight('null'),
    preflight('https://sauceapproved-forge-host.onrender.com.evil.example'),
    preflight(allowed,'DELETE'),
    preflight(allowed,'GET'),
    preflight(allowed,'POST','authorization, content-type'),
    preflight(allowed,'POST','apikey'),
    preflight(allowed,'POST','x-client-info'),
  ]){
    const response=studioOfferPreflight(request);
    assert.equal(response.status,403);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
  }
  assert.equal(studioOfferPreflight(new Request(launchUrl)),null);
});

test('trusted preflight is header-case tolerant but rejects missing JSON content-type',()=>{
  const mixed=studioOfferPreflight(preflight(allowed,'POST','Content-Type'));
  assert.equal(mixed.status,204);
  assert.equal(mixed.headers.get('access-control-allow-origin'),allowed);
  for(const header of ['', 'accept', 'content-type, content-type']){
    const denied=studioOfferPreflight(preflight(allowed,'POST',header));
    assert.equal(denied.status,403);
    assert.equal(denied.headers.get('access-control-allow-origin'),null);
  }
});

test('only trusted origin gets readable software intake success and failure replies',async()=>{
  const req=new Request(launchUrl,{method:'POST',headers:{origin:allowed,'content-type':'application/json'},body:'{}'});
  for(const [status,body] of [[200,{ok:true}],[400,{ok:false,error:'invalid_access_request'}],[429,{ok:false,error:'request_rate_limited'}],[503,{ok:false,error:'storage_error'}]]){
    const original=Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
    const response=studioOfferCorsResponse(req,original);
    assert.equal(response.status,status);
    assert.equal(response.headers.get('access-control-allow-origin'),allowed);
    assert.equal(response.headers.get('access-control-allow-credentials'),null);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match(response.headers.get('vary')??'',/origin/i);
    assert.deepEqual(await response.json(),body);
  }
  const untrusted=new Request(launchUrl,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'});
  const response=studioOfferCorsResponse(untrusted,Response.json({ok:false,error:'request_denied'},{status:403}));
  assert.equal(response.status,403);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
});

test('integration wiring exposes CORS only for the public software access request action',()=>{
  const source=readFileSync(new URL('../supabase/functions/hercules-launch/index.ts',import.meta.url),'utf8');
  const html=readFileSync(new URL('../hercules-forge/offers/sauceapproved-studio/index.html',import.meta.url),'utf8');
  assert.match(source,/from "\.\/studio-offer-cors\.mjs"/);
  assert.match(source,/const studioPreflight=studioOfferPreflight\(req\)/);
  assert.match(source,/if\(studioPreflight\)return studioPreflight/);
  const pos=source.indexOf('if(action==="software_access_request"){');
  const after=source.slice(pos,source.indexOf('if(action==="password_breach_check")',pos));
  assert.ok(pos>0);
  assert.match(after,/studioOfferCorsResponse\(req,Response\.json\(/);
  assert.match(html,/fetch\(SUPA\+"\/functions\/v1\/hercules-launch"/);
  assert.match(html,/action:"software_access_request"/);
  assert.doesNotMatch(after,/secure_signup|studio_purchase_claim|password_breach_check/);
});
