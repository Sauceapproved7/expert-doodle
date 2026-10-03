import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateBatteryDesign} from '../hardware/soundworld/battery-pack-design-v1.mjs';
const base={series:4,nominalV:14.4,energyWh:90,cellTraceability:true,bms:'BQ40Z50-R2',secondaryProtection:true,thermistors:3,serviceDisconnect:true,packBuilderQualified:true,transportEvidence:true};
test('accepts complete 4S EVT battery architecture',()=>assert.equal(evaluateBatteryDesign(base).evtEligible,true));
test('blocks untraceable cells',()=>assert.equal(evaluateBatteryDesign({...base,cellTraceability:false}).evtEligible,false));
test('blocks pack without qualified assembly',()=>assert.equal(evaluateBatteryDesign({...base,packBuilderQualified:false}).evtEligible,false));
test('never authorizes production from design qualification',()=>assert.equal(evaluateBatteryDesign(base).productionAuthorized,false));