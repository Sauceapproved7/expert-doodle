import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  createGrowthEngineManifest, buildGrowthPlan, recordGrowthEvent,
  rankOrganicOpportunities, chooseExperimentWinner, buildCommandCenter
} from '../sauceapproved-studio/growth-engine/core.mjs';

const base={
  brandId:'sauceapproved',
  offer:{id:'titan',name:'Titan Founding Access',url:'https://sauceapproved.com/'},
  source:{title:'Hercules',promise:'Build and operate from one governed system',proof:'Approved product evidence',cta:'Explore Hercules'},
  audiences:['founders','small-business owners'],
  channels:['instagram','tiktok','youtube','email','organic-search']
};

test('manifest exposes all eight governed growth capabilities and two differentiators',()=>{
  const m=createGrowthEngineManifest();
  assert.equal(m.capabilities.length,8);
  assert.deepEqual(m.capabilities.map(x=>x.id),[
    'creative-factory','content-engine','organic-traffic','lead-capture',
    'campaign-brain','experiment-engine','customer-intelligence','command-center'
  ]);
  assert.ok(m.differentiators.length>=2);
  assert.equal(m.executionPolicy,'fail-closed');
});

test('growth plan creates traceable creative, content, traffic, lead and experiment work without auto-publishing',()=>{
  const p=buildGrowthPlan(base);
  assert.equal(p.brandId,'sauceapproved');
  assert.equal(p.publishReady,false);
  assert.equal(p.actions.length,8);
  assert.ok(p.actions.every(x=>x.status==='planned'));
  assert.ok(p.actions.every(x=>x.evidenceRequired===true));
  assert.ok(p.campaign.tracking.campaignId);
  assert.ok(p.experiments.length>=2);
});

test('growth events reject unknown types and preserve attribution dimensions',()=>{
  const e=recordGrowthEvent({type:'purchase',campaignId:'c1',creativeId:'a1',channel:'instagram',value:49,currency:'USD'});
  assert.equal(e.type,'purchase');
  assert.equal(e.value,49);
  assert.equal(e.campaignId,'c1');
  assert.throws(()=>recordGrowthEvent({type:'made-up'}),/growth_event_type_invalid/);
  assert.throws(()=>recordGrowthEvent({type:'purchase',value:-1}),/growth_event_value_invalid/);
});

test('organic opportunities rank by intent, relevance and evidence instead of raw volume',()=>{
  const ranked=rankOrganicOpportunities([
    {id:'broad',intent:.2,relevance:.4,evidence:.2,volume:100000},
    {id:'buyer',intent:.9,relevance:.9,evidence:1,volume:500}
  ]);
  assert.equal(ranked[0].id,'buyer');
  assert.ok(ranked[0].score>ranked[1].score);
});

test('experiment winner requires minimum evidence and meaningful lift',()=>{
  const inconclusive=chooseExperimentWinner({control:{id:'a',visitors:20,conversions:4},variant:{id:'b',visitors:20,conversions:5},minimumVisitors:100,minimumLift:.1});
  assert.equal(inconclusive.status,'collecting');
  const winner=chooseExperimentWinner({control:{id:'a',visitors:1000,conversions:100},variant:{id:'b',visitors:1000,conversions:130},minimumVisitors:500,minimumLift:.1});
  assert.equal(winner.status,'winner');
  assert.equal(winner.winnerId,'b');
});

test('command center optimizes for revenue signal while reporting the full funnel',()=>{
  const events=[
    {type:'impression',campaignId:'c',channel:'instagram'},
    {type:'click',campaignId:'c',channel:'instagram'},
    {type:'lead',campaignId:'c',channel:'instagram'},
    {type:'checkout',campaignId:'c',channel:'instagram'},
    {type:'purchase',campaignId:'c',channel:'instagram',value:49,currency:'USD'}
  ].map(recordGrowthEvent);
  const d=buildCommandCenter({events});
  assert.equal(d.funnel.impressions,1);
  assert.equal(d.funnel.purchases,1);
  assert.equal(d.revenue.total,49);
  assert.equal(d.primarySignal,'revenue');
});
