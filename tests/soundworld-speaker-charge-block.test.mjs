import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateChargeBlock} from '../hardware/soundworld/eda/charge-block-v1.mjs';
const good={pd:'TPS25751',charger:'BQ25792',seriesCells:4,pdTargetW:45,i2cLinked:true,vbusProtected:true,ccProtected:true,packTelemetry:true,thermalAuthority:true,playbackChargeDerate:true};
test('accepts owned 4S USB-C charge architecture',()=>assert.equal(evaluateChargeBlock(good).captureReady,true));
test('rejects wrong cell count',()=>assert.equal(evaluateChargeBlock({...good,seriesCells:5}).captureReady,false));
test('requires PD/charger control link and protection',()=>assert.equal(evaluateChargeBlock({...good,i2cLinked:false}).captureReady,false));
test('never authorizes fabrication',()=>assert.equal(evaluateChargeBlock(good).fabricationReady,false));