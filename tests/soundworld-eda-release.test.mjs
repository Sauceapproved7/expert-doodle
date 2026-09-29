import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateEdaRelease} from '../hardware/soundworld/eda-release-v1.mjs';
const base={schematicFile:true,pcbFile:true,projectFile:true,ercClean:false,drcClean:false,powerReview:false,rfReview:false,thermalReview:false,bomExact:false,gerbersGenerated:false,drillsGenerated:false,placementGenerated:false};
test('EDA source can exist without fabrication release',()=>{const r=evaluateEdaRelease(base);assert.equal(r.edaSourceReady,true);assert.equal(r.fabricationPackageReady,false)});
test('fabrication package requires verified outputs and reviews',()=>assert.equal(evaluateEdaRelease({...base,ercClean:true,drcClean:true,powerReview:true,rfReview:true,thermalReview:true,bomExact:true,gerbersGenerated:true,drillsGenerated:true,placementGenerated:true}).fabricationPackageReady,true));
test('release never authorizes purchase or production',()=>{const r=evaluateEdaRelease({...base,ercClean:true,drcClean:true,powerReview:true,rfReview:true,thermalReview:true,bomExact:true,gerbersGenerated:true,drillsGenerated:true,placementGenerated:true});assert.equal(r.purchaseAuthorized,false);assert.equal(r.productionReady,false)});
