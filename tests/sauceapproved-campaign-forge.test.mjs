import assert from 'node:assert/strict';
import test from 'node:test';
import {createCampaignForgeManifest,buildCampaignPack} from '../sauceapproved-studio/campaign-forge/core.mjs';

test('Campaign Forge exposes an owned local planning surface with two Hercules differentiators',()=>{
  const manifest=createCampaignForgeManifest();
  assert.equal(manifest.product,'Hercules Campaign Forge');
  assert.equal(manifest.executionPolicy,'local-plan-only');
  assert.equal(manifest.serverUpload,false);
  assert.ok(manifest.differentiators.includes('Proof Strip'));
  assert.ok(manifest.differentiators.includes('Campaign DNA Lock'));
});

test('turns one approved source brief into a traceable multi-format campaign pack',()=>{
  const pack=buildCampaignPack({
    title:'SauceApproved Vintage Drop',
    audience:'phone creators and small brands',
    promise:'Old-school look. Hercules control.',
    proof:'Original and processed footage shown side by side.',
    cta:'Try the free preview'
  });
  assert.equal(pack.schema,'sauceapproved.studio.campaign-forge.pack');
  assert.equal(pack.source.title,'SauceApproved Vintage Drop');
  assert.deepEqual(pack.outputs.map(item=>item.format),['hero-15','reel-9x16','square-1x1','story-9x16']);
  assert.ok(pack.outputs.every(item=>item.dna.promise==='Old-school look. Hercules control.'));
  assert.ok(pack.proofStrip.every(item=>item.status==='required'));
  assert.equal(pack.publishReady,false);
});

test('fails closed when campaign truth is incomplete',()=>{
  assert.throws(()=>buildCampaignPack({title:'Drop',audience:'creators'}),/campaign_truth_incomplete/);
});
