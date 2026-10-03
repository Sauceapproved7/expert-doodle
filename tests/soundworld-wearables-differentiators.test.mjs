import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateWearableDifferentiators} from '../hardware/soundworld/wearables/differentiators-v1.mjs';
const x={pods:{privateSceneMesh:true,caseGuardian:true},max:{acousticTwin:true,creatorMonitor:true},baselineSeparated:true,competitorResearchDated:'2026-09-29'};
test('requires two product-specific Pods differentiators',()=>assert.equal(evaluateWearableDifferentiators(x).podsReady,true));
test('requires two product-specific Max differentiators',()=>assert.equal(evaluateWearableDifferentiators(x).maxReady,true));
test('does not convert research into absolute uniqueness claim',()=>assert.equal(evaluateWearableDifferentiators(x).exclusiveClaimAuthorized,false));
