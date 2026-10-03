import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync(new URL('../hardware/soundworld/ACOUSTIC_POWER_ENERGY_TARGETS_V1.md',import.meta.url),'utf8');
test('engineering numbers are explicitly non-marketing targets',()=>{assert.match(s,/not customer-facing claims/);assert.match(s,/No advertised wattage is authorized/);});
test('output evidence couples SPL to distortion and compression',()=>{assert.match(s,/THD\+N and compression reported beside SPL/);});
test('Scene Mode cannot bypass protection',()=>{assert.match(s,/immutable safety ceilings/);});
test('Hercules Link has measurable synchronization target',()=>{assert.match(s,/<1 ms long-term relative drift/);});