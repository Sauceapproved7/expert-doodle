import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync(new URL('../hardware/soundworld/HARDWARE_ARCHITECTURE_V1.md',import.meta.url),'utf8');
test('SoundWorld hardware spec preserves two Hercules differentiators',()=>{assert.match(s,/SoundWorld Scene Mode/);assert.match(s,/Hercules Link/);});
test('SoundWorld hardware claims remain evidence gated',()=>{assert.match(s,/Targets are not claims/);assert.match(s,/production-equivalent hardware/);});
test('SoundWorld hardware is fail-closed for thermal battery and firmware faults',()=>{assert.match(s,/Battery or thermal faults/);assert.match(s,/rolls back to last-known-good image/);});
