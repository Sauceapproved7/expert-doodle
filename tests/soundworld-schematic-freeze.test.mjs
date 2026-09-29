import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateSchematicFreeze} from '../hardware/soundworld/schematic-freeze-v1.mjs';
const x={charger:'BQ25792',wireless:'nRF5340',audioBus:'I2S',ampChannels:4,batterySeries:4,hardwareProtection:true,esdPlan:true,groundingPlan:true,thermalTelemetry:true,pdControllerSelected:false};
test('holds freeze until exact PD controller is selected',()=>assert.equal(evaluateSchematicFreeze(x).frozen,false));
test('freezes interfaces once PD implementation is evidence-backed',()=>assert.equal(evaluateSchematicFreeze({...x,pdControllerSelected:true}).frozen,true));
test('never authorizes PCB fab',()=>assert.equal(evaluateSchematicFreeze({...x,pdControllerSelected:true}).pcbFabAuthorized,false));