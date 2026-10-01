import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceBrainManifest,evaluateCampaignPerformance} from '../sauceapproved-studio/performance-brain/core.mjs';

test('Performance Brain is evidence-only and cannot auto-publish or auto-spend',()=>{
  const manifest=createPerformanceBrainManifest();
  assert.equal(manifest.product,'Hercules Performance Brain');
  assert.equal(manifest.executionPolicy,'evidence-analysis-only');
  assert.equal(manifest.autoPublish,false);
  assert.equal(manifest.autoSpend,false);
  assert.equal(manifest.differentiators.includes('Evidence Grade'),true);
  assert.equal(manifest.differentiators.includes('Outcome Loop'),true);
});

test('Performance Brain refuses winner claims when verified outcome evidence is incomplete',()=>{
  const result=evaluateCampaignPerformance({
    variants:[
      {id:'a',impressions:1000,clicks:80,conversions:0,spend:20,evidence:{impressions:true,clicks:true,conversions:false,spend:true}},
      {id:'b',impressions:1000,clicks:60,conversions:5,spend:20,evidence:{impressions:true,clicks:true,conversions:true,spend:true}}
    ]
  });
  assert.equal(result.winner,null);
  assert.equal(result.status,'insufficient_verified_evidence');
  assert.equal(result.publishReady,false);
});

test('Performance Brain compares verified variants and preserves the metric basis',()=>{
  const result=evaluateCampaignPerformance({
    objective:'conversion_rate',
    variants:[
      {id:'a',impressions:1000,clicks:80,conversions:8,spend:20,evidence:{impressions:true,clicks:true,conversions:true,spend:true}},
      {id:'b',impressions:1000,clicks:60,conversions:3,spend:18,evidence:{impressions:true,clicks:true,conversions:true,spend:true}}
    ]
  });
  assert.equal(result.status,'verified_comparison');
  assert.equal(result.winner,'a');
  assert.equal(result.basis,'conversion_rate');
  assert.equal(result.publishReady,false);
  assert.equal(result.outcomeLoop.nextAction,'review_recommendation');
});
