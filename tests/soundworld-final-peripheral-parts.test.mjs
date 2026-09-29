import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateFinalPeripheralParts} from '../hardware/soundworld/final-peripheral-parts-v1.mjs';
const x={typeCPortProtection:'TPD4S201',boardTempSensor:'TMP117',batteryTempChannels:2,keyedBatteryConnectorQualified:true,speakerConnectorsQualified:true,ercPassed:false,rfReviewPassed:false,thermalReviewPassed:false};
test('parts can freeze while PCB release remains blocked by reviews',()=>{const r=evaluateFinalPeripheralParts(x);assert.equal(r.partsFrozen,true);assert.equal(r.pcbRelease,false);});
test('PCB release requires ERC RF and thermal reviews',()=>assert.equal(evaluateFinalPeripheralParts({...x,ercPassed:true,rfReviewPassed:true,thermalReviewPassed:true}).pcbRelease,true));
test('never grants production readiness',()=>assert.equal(evaluateFinalPeripheralParts({...x,ercPassed:true,rfReviewPassed:true,thermalReviewPassed:true}).productionReady,false));