import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeProviderSpend} from '../sauceapproved-studio/marketing-16/provider-spend-authorization.mjs';

const publish={schema:'sauceapproved.marketing-16.provider-publish-authorization',status:'provider_publish_authorized',publishRequestAuthorized:true,authorizationId:'publish-auth-1',brandId:'SauceApproved',provider:'metricool',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/',budget:{currency:'USD',amount:25},recommendation:'short_video',evidenceIds:['ev-1'],networkCalled:false,providerMutationPerformed:false,spendAllowed:false,automaticMutation:false};
const approval={approved:true,authorizationId:'spend-auth-1',brandId:'SauceApproved',operation:'authorize_provider_spend',currency:'USD',maxAmount:25,evidenceIds:['ev-1']};

test('records explicit spend authorization without spending',()=>{const r=authorizeProviderSpend(publish,approval);assert.equal(r.status,'provider_spend_authorized');assert.equal(r.spendRequestAuthorized,true);assert.equal(r.spendPerformed,false);assert.equal(r.networkCalled,false);assert.equal(r.providerMutationPerformed,false);});
test('requires separate explicit spend approval',()=>{assert.throws(()=>authorizeProviderSpend(publish,{}),/provider_spend_not_authorized/);});
test('rejects amount above approved ceiling',()=>{assert.throws(()=>authorizeProviderSpend({...publish,budget:{currency:'USD',amount:30}},approval),/provider_spend_budget_exceeds_authorization/);});
test('rejects currency mismatch',()=>{assert.throws(()=>authorizeProviderSpend(publish,{...approval,currency:'EUR'}),/provider_spend_currency_mismatch/);});
