import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketing16Runtime} from '../sauceapproved-studio/marketing-16/runtime.mjs';

const receipt={schema:'sauceapproved.studio.performance-brain.review-receipt',status:'review_recorded',decision:'approved',recommendation:'short_video',executionAuthorized:false};
const authorization={approved:true,authorizationId:'auth-runtime-1',brandId:'SauceApproved',operation:'prepare_campaign',evidenceIds:['ev-runtime-1']};

test('runtime prepares an approved campaign without external execution authority',()=>{
  const runtime=createMarketing16Runtime();
  const result=runtime.execute('prepare_campaign',{receipt,authorization});
  assert.equal(result.status,'campaign_prepared');
  assert.equal(result.operation,'prepare_campaign');
  assert.equal(result.recommendation,'short_video');
  assert.equal(result.publishAllowed,false);
  assert.equal(result.spendAllowed,false);
  assert.equal(result.automaticMutation,false);
});

test('runtime refuses preparation without separate execution authorization',()=>{
  const runtime=createMarketing16Runtime();
  assert.throws(()=>runtime.execute('prepare_campaign',{receipt,authorization:{}}),/execution_not_authorized/);
});
