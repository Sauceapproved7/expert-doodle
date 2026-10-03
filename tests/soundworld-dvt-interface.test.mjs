import test from 'node:test';import assert from 'node:assert/strict';
import {validateDvtInterface,protectionAuthority} from '../hardware/soundworld/dvt-interface-v1.mjs';
const valid={batteryBus:{nominalV:14.4},usbPd:{maxInputW:45},amplifier:{channels:4},dsp:{sceneMode:true,immutableProtection:true},mcu:{signedFirmware:true,rollback:true},telemetry:['battery-temp','amplifier-temp','limiter'],link:{roles:['front','fill','dialogue-focus','bass-support'],maxDriftMs:1}};
test('accepts complete DVT interface contract',()=>assert.equal(validateDvtInterface(valid).pass,true));
test('rejects DSP that can bypass protection',()=>assert.equal(validateDvtInterface({...valid,dsp:{sceneMode:true,immutableProtection:false}}).pass,false));
test('requires Hercules Link role contract and drift ceiling',()=>assert.equal(validateDvtInterface({...valid,link:{roles:['front'],maxDriftMs:2}}).pass,false));
test('protection authority outranks Scene Mode and Link',()=>assert.deepEqual(protectionAuthority(),['hardware-protection','firmware-safety','scene-mode','hercules-link']));