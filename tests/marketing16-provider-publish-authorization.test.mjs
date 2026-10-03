import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeProviderPublish} from '../sauceapproved-studio/marketing-16/provider-publish-authorization.mjs';

const dryRun={schema:'sauceapproved.marketing-16.provider-dry-run',status:'provider_dry_run_valid',provider:'metricool',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/',budget:{currency:'USD',amount:25},authorizationId:'auth-1',brandId:'SauceApproved',recommendation:'short_video',evidenceIds:['ev-1'],networkCalled:false,executionAuthorized:false,publishAllowed:false,spendAllowed:false};
const authorization={approved:true,authorizationId:'publish-auth-1',brandId:'SauceApproved',operation:'authorize_provider_publish',evidenceIds:['ev-1']};

test('authorizes a publish request only after a valid provider dry-run',()=>{const r=authorizeProviderPublish(dryRun,authorization);assert.equal(r.status,'provider_publish_authorized');assert.equal(r.publishRequestAuthorized,true);assert.equal(r.networkCalled,false);assert.equal(r.spendAllowed,false);assert.equal(r.automaticMutation,false);});
test('requires separate explicit publish authorization',()=>{assert.throws(()=>authorizeProviderPublish(dryRun,{}),/provider_publish_not_authorized/);});
test('rejects invalid or non-dry-run receipts',()=>{assert.throws(()=>authorizeProviderPublish({...dryRun,status:'invalid'},authorization),/valid_provider_dry_run_required/);});
test('does not authorize spend through the publish gate',()=>{assert.throws(()=>authorizeProviderPublish(dryRun,{...authorization,operation:'authorize_provider_spend'}),/provider_publish_operation_not_allowed/);});
