import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateWearableEvtFeatureGate} from '../hardware/soundworld/wearables/evt-feature-gate-v1.mjs';
const base={micCandidate:'TDK-T5837',micSnrDbA:68,micAopDbSpl:133,privateSceneMesh:true,caseGuardian:true,acousticTwin:true,creatorMonitor:true};
test('four Hercules features are mandatory EVT architecture',()=>assert.equal(evaluateWearableEvtFeatureGate(base).featureArchitectureReady,true));
test('Pods blocks if Case Guardian is absent',()=>assert.equal(evaluateWearableEvtFeatureGate({...base,caseGuardian:false}).podsFeatureReady,false));
test('Max blocks if Acoustic Twin is absent',()=>assert.equal(evaluateWearableEvtFeatureGate({...base,acousticTwin:false}).maxFeatureReady,false));
test('physical validation and exclusivity claims remain blocked',()=>{const r=evaluateWearableEvtFeatureGate(base);assert.equal(r.physicallyValidated,false);assert.equal(r.exclusiveClaimAuthorized,false);});