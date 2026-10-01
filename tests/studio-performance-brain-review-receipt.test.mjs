import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceReviewReceipt} from '../sauceapproved-studio/performance-brain/core.mjs';

test('creates an immutable audit receipt without execution authority',()=>{
  const review={schema:'sauceapproved.studio.performance-brain.review',version:1,status:'recommendation_approved',recommendation:'short_video',reviewer:'owner',approved:true,publishReady:false,autoPublish:false,autoSpend:false,automaticMutation:false};
  const receipt=createPerformanceReviewReceipt(review,{reviewedAt:'2026-10-01T22:15:00Z'});
  assert.equal(receipt.schema,'sauceapproved.studio.performance-brain.review-receipt');
  assert.equal(receipt.decision,'approved');
  assert.equal(receipt.recommendation,'short_video');
  assert.equal(receipt.reviewedAt,'2026-10-01T22:15:00Z');
  assert.equal(receipt.executionAuthorized,false);
  assert.equal(receipt.publishReady,false);
  assert.equal(receipt.autoSpend,false);
  assert.ok(Object.isFrozen(receipt));
});

test('fails closed when no completed review is supplied',()=>{
  const receipt=createPerformanceReviewReceipt({status:'review_required'},{});
  assert.equal(receipt.status,'completed_review_required');
  assert.equal(receipt.executionAuthorized,false);
});
