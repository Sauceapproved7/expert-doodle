import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateTelemetryServiceBlock} from '../hardware/soundworld/eda/telemetry-service-block-v1.mjs';
const good={boardTemp:'TMP117',batteryTempChannels:2,packTelemetry:true,chargerFault:true,ampFaultChannels:4,ampLimiterChannels:4,serviceDebug:true,debugControlled:true,signedFirmwareEnforced:true,keyedBatteryConnector:true,keyedSpeakerOutputs:true,channelLabels:true};
test('accepts complete telemetry and EVT service architecture',()=>assert.equal(evaluateTelemetryServiceBlock(good).captureReady,true));
test('requires dual battery temperature sensing',()=>assert.equal(evaluateTelemetryServiceBlock({...good,batteryTempChannels:1}).captureReady,false));
test('rejects uncontrolled debug',()=>assert.equal(evaluateTelemetryServiceBlock({...good,debugControlled:false}).captureReady,false));
test('debug cannot bypass signed firmware',()=>assert.equal(evaluateTelemetryServiceBlock({...good,signedFirmwareEnforced:false}).captureReady,false));
test('never authorizes fabrication or production',()=>{const r=evaluateTelemetryServiceBlock(good);assert.equal(r.fabricationReady,false);assert.equal(r.productionReady,false)});