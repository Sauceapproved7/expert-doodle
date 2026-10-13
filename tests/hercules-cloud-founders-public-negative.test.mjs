import test from 'node:test';
import assert from 'node:assert/strict';

// DA-47: Public, negative-only proof. Never send a valid email, consent=true,
// an owner credential, or a payment. Nothing in this test can create a lead.
const ORIGIN='https://hercules-cloud-origin-preview.onrender.com';
const RPC='https://xbwuablxhhwsaoomsoco.supabase.co/rest/v1/rpc/hercules_cloud_join_founders';
const BAD_REQUEST=Object.freeze({p_email:'',p_consent:false,p_interest:'both',p_website:''});

async function boundedFetch(url,options={}) {
  return fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),...options});
}

test('public founders assets, CORS preflight, and denied-consent RPC respond without persisting a lead', {timeout:60000}, async()=>{
  const page=await boundedFetch(`${ORIGIN}/founders.html`);
  assert.equal(page.status,200,'published founders page must respond 200');
  const html=await page.text();
  assert.match(html,/id="founders-form"/);
  assert.match(html,/name="consent"[^>]*required/);
  assert.match(html,/id="founders-result"/);

  const scriptResponse=await boundedFetch(`${ORIGIN}/founders.mjs`);
  assert.equal(scriptResponse.status,200,'published client module must respond 200');
  const script=await scriptResponse.text();
  assert.match(script,/No registration has been confirmed/);
  assert.match(script,/Your address is currently unverified/);
  assert.doesNotMatch(script,/sb_secret_|service_role|auth\/v1\/signup|checkout/i,'public browser module must contain no privileged key or paid path');
  const endpoint=script.match(/const endpoint='([^']+)'/)?.[1];
  const publicKey=script.match(/const publishableKey='([^']+)'/)?.[1];
  assert.equal(endpoint,RPC,'published form must use the expected limited RPC');
  assert.match(publicKey||'',/^sb_publishable_[A-Za-z0-9_-]+$/,'browser must expose only a public publishable key');

  const preflight=await boundedFetch(RPC,{
    method:'OPTIONS',
    headers:{
      origin:ORIGIN,
      'access-control-request-method':'POST',
      'access-control-request-headers':'apikey,content-type'
    }
  });
  assert.ok([200,204].includes(preflight.status),`CORS preflight returned ${preflight.status}`);
  const allowOrigin=preflight.headers.get('access-control-allow-origin');
  assert.ok(allowOrigin===ORIGIN||allowOrigin==='*','browser origin must be accepted by CORS preflight');

  // Both fields make a real insertion impossible, even if one validator regresses.
  assert.equal(BAD_REQUEST.p_email,'');
  assert.equal(BAD_REQUEST.p_consent,false);
  const denied=await boundedFetch(RPC,{
    method:'POST',
    headers:{origin:ORIGIN,'content-type':'application/json',apikey:publicKey},
    body:JSON.stringify(BAD_REQUEST)
  });
  assert.equal(denied.status,200,'non-enumerating RPC returns JSON error in an HTTP 200 envelope');
  const postAllow=denied.headers.get('access-control-allow-origin');
  assert.ok(postAllow===ORIGIN||postAllow==='*','cross-origin POST response must be readable by a browser');
  const result=await denied.json();
  assert.deepEqual(result,{ok:false,error:'consent_required'});
  console.log(JSON.stringify({checkedOrigin:ORIGIN,formGet:page.status,scriptGet:scriptResponse.status,corsPreflight:preflight.status,negativePost:denied.status,expectedError:result.error,validEmailSubmitted:false,consentGranted:false,leadCreated:false}));
});
