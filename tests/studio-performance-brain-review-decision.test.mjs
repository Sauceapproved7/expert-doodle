import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPerformanceRecommendation} from '../sauceapproved-studio/performance-brain/core.mjs';

const verified={schema:'sauceapproved.studio.performance-brain.result',version:1,status:'verified_comparison',basis:'conversion_rate',winner:'short_video',publishReady:false,outcomeLoop:{nextAction:'review_recommendation',automaticMutation:false}};

test('requires an explicit review decision',()=>{
  const result=reviewPerformanceRecommendation(verified,{});
  assert.equal(result.status,'review_required');
  assert.equal(result.approved,false);
  assert.equal(result.publishReady,false);
  assert.equal(result.automaticMutation,false);
});

test('records approval without granting execution authority',()=>{
  const result=reviewPerformanceRecommendation(verified,{decision:'approve',reviewer:'owner'});
  assert.equal(result.status,'recommendation_approved');
  assert.equal(result.approved,true);
  assert.equal(result.publishReady,false);
  assert.equal(result.autoPublish,false);
  assert.equal(result.autoSpend,false);
  assert.equal(result.automaticMutation,false);
});

test('records rejection and fails closed for unverified results',()=>{
  assert.equal(reviewPerformanceRecommendation(verified,{decision:'reject',reviewer:'owner'}).status,'recommendation_rejected');
  const incomplete={...verified,status:'insufficient_verified_evidence',winner:null};
  assert.equal(reviewPerformanceRecommendation(incomplete,{decision:'approve',reviewer:'owner'}).status,'verified_recommendation_required');
});
