import test from 'node:test';import assert from 'node:assert/strict';
import {releasePrototypeDrawingPack} from '../hardware/soundworld/prototype-drawing-control-v1.mjs';
const x={drawingIndex:true,criticalDimensions:true,tolerances:true,materials:true,fastenerSchedule:true,gasketSchedule:true,bomRefs:true,revisionBlock:true,deviationProcess:true,inspectionPlan:true};
test('releases complete EVT drawing pack',()=>assert.equal(releasePrototypeDrawingPack(x).released,true));
test('blocks uncontrolled deviations',()=>assert.equal(releasePrototypeDrawingPack({...x,deviationProcess:false}).released,false));
test('never releases production tooling',()=>assert.equal(releasePrototypeDrawingPack(x).toolingAuthorized,false));