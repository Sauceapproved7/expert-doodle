import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeControlledMarketingExecution} from '../sauceapproved-studio/marketing-16/controlled-execution.mjs';

const receipt=Object.freeze({schema:'sauceapproved.studio.performance-brain.review-receipt',status:'review_recorded',decision:'approved',recommendation:'short_video',executionAuthorized:false});
const authorization={approved:true,authorizationId:'auth-1',brandId:'SauceApproved',operation:'prepare_campaign',evidenceIds:['ev-1']};

test('requires an approved completed review receipt',()=>{assert.throws(()=>authorizeControlledMarketingExecution({...receipt,decision:'rejected'},authorization),/approved_review_required/);});
test('requires separate explicit execution authorization',()=>{assert.throws(()=>authorizeControlledMarketingExecution(receipt,{}),/execution_not_authorized/);});
test('authorizes preparation only and keeps external mutations locked',()=>{const r=authorizeControlledMarketingExecution(receipt,authorization);assert.equal(r.authorized,true);assert.equal(r.operation,'prepare_campaign');assert.equal(r.publishAllowed,false);assert.equal(r.spendAllowed,false);assert.equal(r.storefrontMutationAllowed,false);assert.equal(r.paymentAllowed,false);assert.equal(r.dnsMutationAllowed,false);});
test('rejects publish and spend operations',()=>{for(const operation of ['publish_campaign','spend_budget']) assert.throws(()=>authorizeControlledMarketingExecution(receipt,{...authorization,operation}),/operation_not_allowed/);});
