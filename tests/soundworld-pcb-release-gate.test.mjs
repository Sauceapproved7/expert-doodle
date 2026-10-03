import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePcbRelease} from '../hardware/soundworld/pcb-release-gate-v1.mjs';
const x={ercClean:true,powerGroundReview:true,typeCChecklist:true,rfReferenceLayout:true,audioTimingReview:true,thermalReview:true,connectorReview:true,bomTraceable:true};
test('releases EVT PCB package only after all reviews',()=>assert.equal(evaluatePcbRelease(x).evtPcbRelease,true));
test('blocks release without RF reference review',()=>assert.equal(evaluatePcbRelease({...x,rfReferenceLayout:false}).evtPcbRelease,false));
test('blocks release without Type-C checklist',()=>assert.equal(evaluatePcbRelease({...x,typeCChecklist:false}).evtPcbRelease,false));
test('never authorizes production',()=>assert.equal(evaluatePcbRelease(x).productionAuthorized,false));