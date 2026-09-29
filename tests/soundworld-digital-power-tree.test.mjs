import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePowerTree} from '../hardware/soundworld/digital-power-tree-v1.mjs';
const x={packNominalV:14.4,primaryBuck:'TPS62933',primaryMaxA:3,rfBuck:'TPS62840',rfInputFromLowVoltageRail:true,railBudgetEvidence:true,thermalBudgetEvidence:true};
test('accepts cascaded digital power tree',()=>assert.equal(evaluatePowerTree(x).freezeReady,true));
test('rejects RF buck directly on 4S bus',()=>assert.equal(evaluatePowerTree({...x,rfInputFromLowVoltageRail:false}).freezeReady,false));
test('never authorizes PCB fab',()=>assert.equal(evaluatePowerTree(x).pcbFabAuthorized,false));