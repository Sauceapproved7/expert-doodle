import test from 'node:test';import assert from 'node:assert/strict';
import {driverDisplacementLiters,requiredPassiveRadiatorDisplacementLiters,netVolumeLiters,assessEvta} from '../hardware/soundworld/acoustic-model-v1.mjs';
test('calculates driver displacement and 2x passive-radiator requirement',()=>{const vd=driverDisplacementLiters({sdCm2:40,xmaxMm:8,count:2});assert.equal(vd,0.064);assert.equal(requiredPassiveRadiatorDisplacementLiters(vd),0.128);});
test('calculates net enclosure after internal displacement',()=>{assert.equal(netVolumeLiters({grossLiters:7.5,drivers:.4,radiators:.3,battery:.8,electronics:.3,bracing:.4}),5.3);});
test('fails closed when PR displacement is inadequate',()=>{const r=assessEvta({netLiters:6,tuningHz:53,driverVdLiters:.1,passiveRadiatorVdLiters:.15});assert.equal(r.pass,false);assert.ok(r.reasons.includes('passive_radiator_displacement_margin_low'));assert.equal(r.executionReady,false);assert.equal(r.claimReady,false);});
test('accepts a candidate only inside all EVT-A windows',()=>{assert.equal(assessEvta({netLiters:6,tuningHz:53,driverVdLiters:.1,passiveRadiatorVdLiters:.22}).pass,true);});
