import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateChargerMigration} from '../hardware/soundworld/eda/charger-migration-v1.mjs';
const good={from:'BQ25792RQMR',to:'BQ25798RQMR',cells:4,package:'RQM-29 4x4mm VQFN-HR',tps25751Supported:true,referenceEvm:true,i2c:true,inputMinV:3.6,inputMaxV:24,chargeCurrentMaxA:5,pinMapReviewed:true,registerMapReviewed:true,pdConfigReviewed:true,referenceNetworkReviewed:true};
test('freezes BQ25798 only after controlled migration review',()=>{const r=evaluateChargerMigration(good);assert.equal(r.productionChargerFrozen,true);assert.equal(r.lifecycleHold,false)});
test('never calls migration drop-in compatible',()=>assert.equal(evaluateChargerMigration(good).dropInAuthorized,false));
test('requires pin register PD and network review',()=>assert.equal(evaluateChargerMigration({...good,registerMapReviewed:false}).captureFreezeReady,false));
test('never authorizes fabrication',()=>assert.equal(evaluateChargerMigration(good).fabricationReady,false));