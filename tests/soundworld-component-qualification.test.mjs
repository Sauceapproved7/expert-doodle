import test from 'node:test';import assert from 'node:assert/strict';
import {qualifyComponent} from '../hardware/soundworld/component-qualification-v1.mjs';
const good={category:'amplifier',electricalHeadroom:true,thermalEvidence:true,lifecycleOk:true,firmwareSupport:true,compliancePath:true,sourcingRisk:'low',interfaceCompatible:true,score:88};
test('qualifies evidence-complete candidate',()=>assert.equal(qualifyComponent(good).qualified,true));
test('hard gate overrides high score',()=>assert.equal(qualifyComponent({...good,thermalEvidence:false,score:100}).qualified,false));
test('rejects high sourcing risk',()=>assert.equal(qualifyComponent({...good,sourcingRisk:'high'}).qualified,false));
test('never marks component production ready from desk qualification',()=>assert.equal(qualifyComponent(good).productionReady,false));