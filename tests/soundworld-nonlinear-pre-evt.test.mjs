import test from 'node:test';import assert from 'node:assert/strict';
import {screenExcursionPoint,deriveLimiterCurve} from '../hardware/soundworld/nonlinear-pre-evt-v1.mjs';
test('rejects driver excursion beyond 85 percent Xmax',()=>assert.equal(screenExcursionPoint({driverMm:4,radiatorMm:5,driverXmaxMm:4.6,radiatorXmaxMm:9}).pass,false));
test('rejects radiator excursion beyond 85 percent Xmax',()=>assert.equal(screenExcursionPoint({driverMm:3,radiatorMm:8,driverXmaxMm:4.6,radiatorXmaxMm:9}).pass,false));
test('accepts point inside both margins but never claim ready',()=>{const r=screenExcursionPoint({driverMm:3,radiatorMm:6,driverXmaxMm:4.6,radiatorXmaxMm:9});assert.equal(r.pass,true);assert.equal(r.claimReady,false);});
test('limiter curve tightens below tuning and never exceeds base voltage',()=>{const c=deriveLimiterCurve({tuningHz:53,baseVrms:10,frequenciesHz:[30,40,53,80]});assert.ok(c[0].maxVrms<c[1].maxVrms);assert.equal(c[2].maxVrms,10);assert.equal(c[3].maxVrms,10);});