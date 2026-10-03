import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketing16Runtime} from '../sauceapproved-studio/marketing-16/runtime.mjs';

const authorization={schema:'sauceapproved.marketing-16.provider-publish-authorization',status:'provider_publish_authorized',publishRequestAuthorized:true,authorizationId:'publish-auth-1',brandId:'SauceApproved',provider:'metricool',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/',budget:{currency:'USD',amount:25},recommendation:'short_video',evidenceIds:['ev-1'],networkCalled:false,providerMutationPerformed:false,spendAllowed:false,automaticMutation:false};

test('runtime exposes provider publish simulation without external execution',()=>{const runtime=createMarketing16Runtime();const r=runtime.execute('provider_publish_simulation',{authorization});assert.equal(r.status,'provider_publish_simulated');assert.equal(r.networkCalled,false);assert.equal(r.publishPerformed,false);assert.equal(r.spendAllowed,false);});
test('runtime provider publish simulation fails closed without authorization',()=>{const runtime=createMarketing16Runtime();assert.throws(()=>runtime.execute('provider_publish_simulation',{authorization:{...authorization,publishRequestAuthorized:false}}),/provider_publish_authorization_required/);});
