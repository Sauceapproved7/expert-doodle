import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateWearablePlatform} from '../hardware/soundworld/wearables/platform-v1.mjs';
const x={pods:true,overEar:true,anc:true,transparency:true,spatial:true,multipoint:true,soundDna:true,continuity:true,hearingProtection:true,signedFirmware:true,localProfile:true};
test('accepts complete premium wearable platform',()=>assert.equal(evaluateWearablePlatform(x).architectureReady,true));
test('requires both Hercules differentiators',()=>assert.equal(evaluateWearablePlatform({...x,continuity:false}).architectureReady,false));
test('requires hearing protection above feature layers',()=>assert.equal(evaluateWearablePlatform({...x,hearingProtection:false}).architectureReady,false));
test('never marks unbuilt hardware production ready',()=>assert.equal(evaluateWearablePlatform(x).productionReady,false));