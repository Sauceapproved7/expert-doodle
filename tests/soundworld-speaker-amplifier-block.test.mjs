import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateAmplifierBlock} from '../hardware/soundworld/eda/amplifier-block-v1.mjs';
const good={devices:2,part:'TAS5825M',channels:4,pvddNominalV:14.4,digitalAudio:true,hardwareFaultAuthority:true,thermalProtection:true,excursionProtection:true,sceneCannotOverrideProtection:true,linkCannotOverrideProtection:true,outputFilterEvidence:false};
test('accepts four-channel capture architecture',()=>{const r=evaluateAmplifierBlock(good);assert.equal(r.captureReady,true);assert.equal(r.outputNetworkFrozen,false)});
test('requires immutable protection authority',()=>assert.equal(evaluateAmplifierBlock({...good,sceneCannotOverrideProtection:false}).captureReady,false));
test('output network freezes only with load and EMC evidence',()=>assert.equal(evaluateAmplifierBlock({...good,outputFilterEvidence:true}).outputNetworkFrozen,true));
test('never authorizes fabrication or production',()=>{const r=evaluateAmplifierBlock({...good,outputFilterEvidence:true});assert.equal(r.fabricationReady,false);assert.equal(r.productionReady,false)});