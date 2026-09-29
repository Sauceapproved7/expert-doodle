import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateDigitalAudioBlock} from '../hardware/soundworld/eda/digital-audio-block-v1.mjs';
const good={packNominalV:14.4,primaryBuck:'TPS62933',rfBuck:'TPS62840',rfBuckDownstream:true,wireless:'nRF5340',dsp:'ADAU1467',sampleRateKhz:48,mclkMHz:12.288,i2s:true,rfKeepoutRequired:true,clockOwnerReviewed:false};
test('accepts capture architecture while timing ownership remains review-gated',()=>{const r=evaluateDigitalAudioBlock(good);assert.equal(r.captureReady,true);assert.equal(r.timingFrozen,false)});
test('rejects TPS62840 directly on 4S bus',()=>assert.equal(evaluateDigitalAudioBlock({...good,rfBuckDownstream:false}).captureReady,false));
test('timing freeze requires explicit clock ownership review',()=>assert.equal(evaluateDigitalAudioBlock({...good,clockOwnerReviewed:true}).timingFrozen,true));
test('never authorizes fabrication',()=>assert.equal(evaluateDigitalAudioBlock({...good,clockOwnerReviewed:true}).fabricationReady,false));