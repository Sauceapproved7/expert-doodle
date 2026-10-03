import test from 'node:test';import assert from 'node:assert/strict';
import {screenAcousticStack} from '../hardware/soundworld/acoustic-stack-screen-v1.mjs';
const candidate={active:{count:2,vdCm3:12.2,rmsW:30,fsHz:74},radiator:{count:2,sdCm2:31.2,xmaxMm:9},enclosure:{netLiters:5.3,tuningHz:53},amplifier:{availableWPerMidbass:25}};
test('accepts desk candidate when displacement and power gates clear',()=>assert.equal(screenAcousticStack(candidate).pass,true));
test('rejects passive radiator displacement below 2x active Vd',()=>assert.equal(screenAcousticStack({...candidate,radiator:{count:2,sdCm2:31.2,xmaxMm:7}}).pass,false));
test('rejects amplifier power above active RMS rating',()=>assert.equal(screenAcousticStack({...candidate,amplifier:{availableWPerMidbass:35}}).pass,false));
test('desk screen never authorizes prototype or claims',()=>{const r=screenAcousticStack(candidate);assert.equal(r.prototypeReady,false);assert.equal(r.claimReady,false);});