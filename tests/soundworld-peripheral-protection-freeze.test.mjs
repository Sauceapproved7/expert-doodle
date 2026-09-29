import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePeripheralFreeze} from '../hardware/soundworld/peripheral-protection-freeze-v1.mjs';
const x={audioClockMHz:12.288,i2sSampleRateKhz:48,usbEsd:'TPD4E05U06',batteryTempSensors:2,ampTempTelemetry:true,keyedBatteryConnector:true,serviceDebugControlled:true};
test('accepts SoundWorld peripheral architecture',()=>assert.equal(evaluatePeripheralFreeze(x).freezeReady,true));
test('requires dual battery temperature sensing',()=>assert.equal(evaluatePeripheralFreeze({...x,batteryTempSensors:1}).freezeReady,false));
test('blocks uncontrolled debug',()=>assert.equal(evaluatePeripheralFreeze({...x,serviceDebugControlled:false}).freezeReady,false));
test('never authorizes fabrication',()=>assert.equal(evaluatePeripheralFreeze(x).pcbFabAuthorized,false));