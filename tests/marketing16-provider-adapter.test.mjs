import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateProviderPublish} from '../sauceapproved-studio/marketing-16/provider-adapter.mjs';

const authorization={schema:'sauceapproved.marketing-16.provider-publish-authorization',status:'provider_publish_authorized',publishRequestAuthorized:true,authorizationId:'publish-auth-1',brandId:'SauceApproved',provider:'metricool',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/',budget:{currency:'USD',amount:25},recommendation:'short_video',evidenceIds:['ev-1'],networkCalled:false,providerMutationPerformed:false,spendAllowed:false,automaticMutation:false};

test('simulates an authorized provider publish without network or mutation',()=>{const r=simulateProviderPublish(authorization);assert.equal(r.status,'provider_publish_simulated');assert.equal(r.provider,'metricool');assert.equal(r.networkCalled,false);assert.equal(r.providerMutationPerformed,false);assert.equal(r.publishPerformed,false);assert.equal(r.spendAllowed,false);});
test('rejects artifacts without explicit publish authorization',()=>{assert.throws(()=>simulateProviderPublish({...authorization,publishRequestAuthorized:false}),/provider_publish_authorization_required/);});
test('rejects artifacts that claim spend authority',()=>{assert.throws(()=>simulateProviderPublish({...authorization,spendAllowed:true}),/provider_publish_authorization_invalid/);});
