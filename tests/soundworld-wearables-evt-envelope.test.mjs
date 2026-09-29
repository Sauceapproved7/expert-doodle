import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateWearableEvtEnvelope} from '../hardware/soundworld/wearables/evt-envelope-v1.mjs';
const base={podsMassTargetG:6,maxMassTargetG:300,podsFeatureTests:true,maxFeatureTests:true,acousticMeasurements:false,batteryMeasurements:false,thermalMeasurements:false};
test('envelope can freeze before physical validation',()=>assert.equal(evaluateWearableEvtEnvelope(base).envelopeFrozen,true));
test('EVT acceptance waits for measured acoustic battery thermal evidence',()=>assert.equal(evaluateWearableEvtEnvelope(base).evtAccepted,false));
test('measured evidence can satisfy engineering acceptance only',()=>{const r=evaluateWearableEvtEnvelope({...base,acousticMeasurements:true,batteryMeasurements:true,thermalMeasurements:true});assert.equal(r.evtAccepted,true);assert.equal(r.productionReady,false)});
