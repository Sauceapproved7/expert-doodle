import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateIndustrialEnvelope} from '../hardware/soundworld/industrial-envelope-v1.mjs';
const good={externalL:360,externalH:160,externalD:150,acousticNetL:5.3,batteryEnvelope:[99,56,83],opposedRadiators:true,stereoSymmetry:true,serviceAccess:true,rfKeepout:true,impactClearanceMm:6,handleIndependent:true};
test('accepts separated SoundWorld EVT envelope',()=>assert.equal(evaluateIndustrialEnvelope(good).cadFreezeReady,true));
test('rejects insufficient impact clearance',()=>assert.equal(evaluateIndustrialEnvelope({...good,impactClearanceMm:3}).cadFreezeReady,false));
test('rejects loss of acoustic net volume',()=>assert.equal(evaluateIndustrialEnvelope({...good,acousticNetL:4.7}).cadFreezeReady,false));
test('never marks production ready',()=>assert.equal(evaluateIndustrialEnvelope(good).productionReady,false));