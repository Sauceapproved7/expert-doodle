import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCampaign,buildTrackedUrl,calculateEconomics,rankOpportunities,reviewClaims,buildContentPack} from '../hercules-marketing-command/engine.mjs';

const base={division:'apparel',channel:'instagram',title:'Premium hoodie',audience:'Streetwear buyers',promise:'A distinctive graphic hoodie',proof:'Product photos and sizing guide',cta:'See the hoodie',destination:'https://sauceapproved.com/products/sauceapproved-premium-hoodie',price:35.97,unitCost:20,fees:2,fulfillmentCost:0,cac:5};

test('draft without proof remains blocked even when messaging is complete',()=>{
  const report=evaluateCampaign({...base,proof:''});
  assert.equal(report.publicationAllowed,false);
  assert.equal(report.reviewReady,false);
  assert.ok(report.blockers.includes('proof_required'));
});

test('completed brief remains non-publishing pending independent authorization',()=>{
  const report=evaluateCampaign(base);
  assert.equal(report.reviewReady,true);
  assert.equal(report.publicationAllowed,false);
  assert.equal(report.automaticSpendAllowed,false);
  assert.equal(report.automaticOutreachAllowed,false);
});

test('paid advertising stays disabled irrespective of supplied approval flags',()=>{
  const report=evaluateCampaign({...base,channel:'meta_ads',ownerApproved:true,budgetApproved:true});
  assert.equal(report.publicationAllowed,false);
  assert.equal(report.automaticSpendAllowed,false);
});

test('email campaign requires evidence of recipient consent before review',()=>{
  const report=evaluateCampaign({...base,channel:'email',recipientConsent:false});
  assert.ok(report.blockers.includes('recipient_consent_required'));
  assert.equal(report.reviewReady,false);
  assert.equal(evaluateCampaign({...base,channel:'email',recipientConsent:true}).reviewReady,true);
});

test('tracking accepts owned HTTPS destinations and preserves safe query parameters',()=>{
  const url=new URL(buildTrackedUrl('https://sauceapproved.com/products/hoodie?ref=launch&utm_source=old#size',{source:'instagram',medium:'organic_social',campaign:'oct launch'}));
  assert.equal(url.searchParams.get('ref'),'launch');
  assert.equal(url.searchParams.get('utm_source'),'instagram');
  assert.equal(url.searchParams.get('utm_campaign'),'oct_launch');
  assert.equal(url.hash,'#size');
});

test('tracking rejects credential URLs, insecure URLs, and external domains',()=>{
  for(const link of ['http://sauceapproved.com','javascript:alert(1)','https://evil.example','https://sauceapproved.com.evil.example','https://x:y@sauceapproved.com','https://127.0.0.1/']) {
    assert.throws(()=>buildTrackedUrl(link,{source:'social',medium:'organic',campaign:'test'}));
  }
});

test('unit economics are bounded and do not invent revenue',()=>{
  const m=calculateEconomics({price:35.97,unitCost:20,fees:2,fulfillmentCost:0,cac:5});
  assert.equal(m.breakEvenCac,13.97);
  assert.equal(m.netContribution,8.97);
  assert.equal(m.profitable,true);
  assert.equal(m.reportedRevenue,null);
  for(const v of [-1,'Infinity',Infinity,NaN]) assert.throws(()=>calculateEconomics({price:v,unitCost:0,fees:0,fulfillmentCost:0,cac:0}));
});

test('claim review flags fabricated endorsements and unsubstantiated guarantees',()=>{
  const flags=reviewClaims('NASA-approved hoodie, guaranteed 10x sales and only two left!');
  assert.ok(flags.some(x=>x.code==='institution_endorsement'));
  assert.ok(flags.some(x=>x.code==='outcome_guarantee'));
  assert.ok(flags.some(x=>x.code==='scarcity_claim'));
});

test('ranking rejects untraceable opportunities and never claims measured demand',()=>{
  const ranked=rankOpportunities([
    {title:'organic apparel guide',sourceUrl:'https://example.org/public-post',relevance:4,evidenceStrength:3,effort:2},
    {title:'unknown opportunity',sourceUrl:'',relevance:5,evidenceStrength:5,effort:1}
  ]);
  assert.equal(ranked.length,1);
  assert.equal(ranked[0].measuredDemand,false);
});

test('content pack preserves audience, CTA and claim across layouts and never auto-publishes',()=>{
  const pack=buildContentPack(base);
  assert.equal(pack.length,4);
  assert.deepEqual(pack.map(x=>x.format),['hero-15','reel-9x16','square-1x1','story-9x16']);
  assert.ok(pack.every(x=>x.audience===base.audience&&x.cta===base.cta&&x.promise===base.promise&&x.published===false));
});

test('reject unsupported divisions/channels and unsafe input lengths',()=>{
  assert.ok(evaluateCampaign({...base,division:'other'}).blockers.includes('unsupported_division'));
  assert.ok(evaluateCampaign({...base,channel:'bots'}).blockers.includes('unsupported_channel'));
  assert.ok(evaluateCampaign({...base,promise:'x'.repeat(1000)}).blockers.includes('invalid_promise'));
});
