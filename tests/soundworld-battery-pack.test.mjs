import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateSoundWorldPack} from '../hardware/soundworld/soundworld-battery-pack-v1.mjs';
const p={seriesCells:4,nominalV:14.4,energyWh:90,cellTraceability:true,packManager:'BQ40Z50',dualTemperatureSensing:true,cellBalancing:true,overVoltageProtection:true,underVoltageProtection:true,overCurrentProtection:true,shortCircuitProtection:true,serviceDisconnect:true,transportEvidence:false};
test('battery architecture remains validation blocked without transport evidence',()=>assert.equal(evaluateSoundWorldPack(p).evtReady,false));
test('accepts architecture when all evidence gates exist',()=>assert.equal(evaluateSoundWorldPack({...p,transportEvidence:true}).evtReady,true));
test('never grants production from architecture',()=>assert.equal(evaluateSoundWorldPack({...p,transportEvidence:true}).productionReady,false));