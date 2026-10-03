import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync(new URL('../hardware/soundworld/EVT_PROTOTYPE_SPEC_V1.md',import.meta.url),'utf8');
test('EVT integrates acoustic power firmware and telemetry',()=>{for(const x of ['Mechanical / acoustic','Power / charging','Firmware','Instrumentation'])assert.match(s,new RegExp(x));});
test('both mandatory Hercules differentiators survive prototype specification',()=>{assert.match(s,/SoundWorld Scene Mode/);assert.match(s,/Hercules Link/);});
test('EVT rejects performance that requires defeated protection',()=>{assert.match(s,/requires disabling protection/);});
test('prototype cannot silently become a product claim',()=>{assert.match(s,/productionReady: false/);assert.match(s,/claimReady: false/);});