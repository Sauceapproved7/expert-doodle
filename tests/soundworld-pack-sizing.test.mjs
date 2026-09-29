import test from 'node:test';import assert from 'node:assert/strict';
import {designPack} from '../hardware/soundworld/soundworld-pack-sizing-v1.mjs';
test('4S2P P45B computes owned pack nominal energy',()=>{const r=designPack({series:4,parallel:2,cellV:3.6,cellAh:4.5});assert.equal(r.nominalV,14.4);assert.equal(r.capacityAh,9);assert.equal(r.energyWh,129.6);});
test('pack remains prototype-only',()=>assert.equal(designPack({series:4,parallel:2,cellV:3.6,cellAh:4.5}).productionReady,false));