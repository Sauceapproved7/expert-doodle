import test from 'node:test';import assert from 'node:assert/strict';
import {qualifyRemainingEvtParts} from '../hardware/soundworld/remaining-parts-freeze-v1.mjs';
const base={tweeter:'ND20FA-6',wireless:'nRF5340',charger:'BQ25792',batteryManager:'BQ40Z50',batteryNominalV:14.4,batteryWh:90,batteryPackEvidence:false};
test('keeps pack blocked without pack evidence',()=>assert.equal(qualifyRemainingEvtParts(base).bomFrozen,false));
test('freezes electronics when evidence-backed pack is supplied',()=>assert.equal(qualifyRemainingEvtParts({...base,batteryPackEvidence:true}).bomFrozen,true));
test('rejects battery outside architecture window',()=>assert.equal(qualifyRemainingEvtParts({...base,batteryPackEvidence:true,batteryWh:60}).bomFrozen,false));