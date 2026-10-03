import test from 'node:test';import assert from 'node:assert/strict';
import {assessEnclosureLayout} from '../hardware/soundworld/enclosure-layout-v1.mjs';
const base={grossLiters:7.5,opposedRadiators:true,stereoSymmetry:true,batteryIsolated:true,pcbIsolated:true,antennaKeepoutMm:12,gasketZones:true,serviceAccess:['battery','usb-c'],impactClearanceMm:6};
test('accepts DVT enclosure geometry contract',()=>assert.equal(assessEnclosureLayout(base).pass,true));
test('rejects non-opposed radiators',()=>assert.equal(assessEnclosureLayout({...base,opposedRadiators:false}).pass,false));
test('rejects blocked RF keepout',()=>assert.equal(assessEnclosureLayout({...base,antennaKeepoutMm:2}).pass,false));
test('requires battery and USB-C service access',()=>assert.equal(assessEnclosureLayout({...base,serviceAccess:['battery']}).pass,false));
test('rejects insufficient impact clearance',()=>assert.equal(assessEnclosureLayout({...base,impactClearanceMm:2}).pass,false));