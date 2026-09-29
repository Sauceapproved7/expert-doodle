import test from 'node:test';import assert from 'node:assert/strict';
import {assessChargeState,choosePdProfile} from '../hardware/soundworld/power-system-v1.mjs';
test('rejects charging outside battery temperature window',()=>{const r=assessChargeState({batteryTempC:50,packVoltageV:14.4,packCurrentA:0,playingWatts:0});assert.equal(r.chargeAllowed,false);});
test('derates charge while high playback load is active',()=>{const r=assessChargeState({batteryTempC:30,packVoltageV:14.4,packCurrentA:1,playingWatts:35});assert.equal(r.mode,'playback-priority-derated-charge');});
test('selects no more PD power than hardware limit',()=>{assert.equal(choosePdProfile([15,27,45,65],45),45);});
test('fails closed when no acceptable PD source exists',()=>{assert.equal(choosePdProfile([5,10],15),null);});