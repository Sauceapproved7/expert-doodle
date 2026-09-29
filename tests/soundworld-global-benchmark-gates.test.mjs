import test from 'node:test';import assert from 'node:assert/strict';
import {benchmarkReadiness} from '../hardware/soundworld/global-benchmark-gates-v1.mjs';
const pass={runtimeHours:30,ingress:'IP68',linkRoleRouting:true,linkMeasuredDriftMs:0.8,replaceableBattery:true,usbCPd:true,measuredAcoustics:true};
test('benchmark gate requires evidence-backed premium targets',()=>assert.equal(benchmarkReadiness(pass).pass,true));
test('blocks unmeasured acoustics',()=>assert.equal(benchmarkReadiness({...pass,measuredAcoustics:false}).pass,false));
test('blocks ordinary grouping without role routing',()=>assert.equal(benchmarkReadiness({...pass,linkRoleRouting:false}).pass,false));
test('blocks Link drift above engineering target',()=>assert.equal(benchmarkReadiness({...pass,linkMeasuredDriftMs:1.2}).pass,false));