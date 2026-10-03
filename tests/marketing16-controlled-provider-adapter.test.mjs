import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlledProviderAdapter} from '../sauceapproved-studio/marketing-16/controlled-provider-adapter.mjs';

test('controlled adapter requires a credential reference and never accepts embedded secrets',()=>{
  assert.throws(()=>createControlledProviderAdapter({provider:'metricool',publish:async()=>({externalId:'x'})}),/provider_credential_reference_required/);
  assert.throws(()=>createControlledProviderAdapter({provider:'metricool',credentialRef:'vault://metricool',token:'secret',publish:async()=>({externalId:'x'})}),/embedded_provider_credentials_forbidden/);
});

test('controlled adapter exposes a publish handler without spend authority',async()=>{
  let observed;
  const adapter=createControlledProviderAdapter({provider:'metricool',credentialRef:'vault://metricool/main',publish:async input=>{observed=input;return {externalId:'post-1'};}});
  const result=await adapter.publish({authorizationId:'auth-1',brandId:'SauceApproved',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/'});
  assert.equal(result.externalId,'post-1');
  assert.equal(observed.credentialRef,'vault://metricool/main');
  assert.equal(observed.spendAllowed,false);
  assert.equal(observed.automaticMutation,false);
  assert.equal(adapter.credentialsEmbedded,false);
  assert.equal(adapter.spendAllowed,false);
});
