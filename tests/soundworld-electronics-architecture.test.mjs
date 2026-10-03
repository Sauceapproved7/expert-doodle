import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateElectronicsArchitecture} from '../hardware/soundworld/electronics-architecture-v1.mjs';
const x={batteryBusV:14.4,ampChannels:4,dedicatedDsp:true,wirelessControl:true,usbCPd:true,bmsTelemetry:true,dualTemp:true,hardwareProtectionHighest:true,signedFirmware:true,serviceDebugLocked:true};
test('accepts complete custom electronics architecture',()=>assert.equal(evaluateElectronicsArchitecture(x).schematicReady,true));
test('rejects protection below software authority',()=>assert.equal(evaluateElectronicsArchitecture({...x,hardwareProtectionHighest:false}).schematicReady,false));
test('requires four amplifier channels',()=>assert.equal(evaluateElectronicsArchitecture({...x,ampChannels:2}).schematicReady,false));
test('never authorizes PCB production',()=>assert.equal(evaluateElectronicsArchitecture(x).pcbProductionAuthorized,false));