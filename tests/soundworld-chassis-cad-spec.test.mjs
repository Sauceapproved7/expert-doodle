import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateChassisCad} from '../hardware/soundworld/chassis-cad-spec-v1.mjs';
const x={shellWallMm:3,baffleWallMm:4,braceCount:3,fastenerZones:8,gasketInterfaces:3,servicePanelIndependentSeal:true,batteryStructuralRetention:true,radiatorSweepClear:true,rfKeepoutClear:true};
test('accepts complete EVT chassis study',()=>assert.equal(evaluateChassisCad(x).cadReady,true));
test('rejects thin study shell',()=>assert.equal(evaluateChassisCad({...x,shellWallMm:1.5}).cadReady,false));
test('rejects blocked radiator sweep',()=>assert.equal(evaluateChassisCad({...x,radiatorSweepClear:false}).cadReady,false));
test('never marks production ready',()=>assert.equal(evaluateChassisCad(x).productionReady,false));