import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateWearableRfq} from '../hardware/soundworld/wearables/evt-rfq-v1.mjs';
const x={podsUnits:5,maxUnits:3,exactMpns:true,authorizedSources:true,traceability:true,noSilentSubstitutions:true,complianceDocs:true,ownerPurchaseApproval:false};
test('RFQ can release for quote without purchase authority',()=>{const r=evaluateWearableRfq(x);assert.equal(r.quoteReady,true);assert.equal(r.purchaseAuthorized,false)});
test('blocks quote package without traceability',()=>assert.equal(evaluateWearableRfq({...x,traceability:false}).quoteReady,false));
test('never grants production readiness',()=>assert.equal(evaluateWearableRfq(x).productionReady,false));