import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync(new URL('../hardware/soundworld/DVT_PCB_ARCHITECTURE_V1.md',import.meta.url),'utf8');
test('PCB architecture partitions power radio control DSP and four output channels',()=>{for(const x of ['USB-C PD','Bluetooth/radio','Control MCU','Dedicated audio DSP','Four independent Class-D'])assert.match(s,new RegExp(x));});
test('component choices remain evidence gated',()=>assert.match(s,/No amplifier\/DSP\/MCU\/radio\/charger\/BMS part is frozen/));
test('production debug cannot create unauthenticated control',()=>assert.match(s,/must not create an unauthenticated control path/));