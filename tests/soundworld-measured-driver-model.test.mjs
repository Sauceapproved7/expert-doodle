import test from 'node:test';import assert from 'node:assert/strict';
import {validateMeasuredTs,closedBoxEstimate,excursionRiskEnvelope,impedanceEstimate} from '../hardware/soundworld/measured-driver-model-v1.mjs';
const ts={fsHz:55,qts:.48,vasLiters:2.4,reOhms:3.4,leMilliHenry:.18,sdCm2:40,xmaxMm:8};
test('refuses incomplete measured T/S data',()=>{assert.throws(()=>validateMeasuredTs({...ts,xmaxMm:undefined}),/measured T\/S/);});
test('derives a finite enclosure-response estimate from measured T/S inputs',()=>{const r=closedBoxEstimate(ts,5.3);assert.ok(r.fcHz>0);assert.ok(r.qtc>0);});
test('flags excursion when requested displacement exceeds measured Xmax',()=>{const r=excursionRiskEnvelope({sdCm2:40,xmaxMm:8,requiredVolumeLiters:.04,count:1});assert.equal(r.pass,false);});
test('estimates rising voice-coil impedance from Re and Le',()=>{const z1=impedanceEstimate(ts,100);const z2=impedanceEstimate(ts,10000);assert.ok(z2>z1);});