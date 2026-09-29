import test from 'node:test';import assert from 'node:assert/strict';
import {authorizeEvt,authorizeDvt} from '../hardware/soundworld/evt-authorization-v1.mjs';
const evt={architectureFrozen:true,componentShortlist:true,enclosureConstraints:true,powerSafety:true,excursionProtection:true,testPlan:true,instrumentation:true};
test('authorizes EVT build only when engineering package is complete',()=>assert.equal(authorizeEvt(evt).authorized,true));
test('blocks EVT when safety package is incomplete',()=>assert.equal(authorizeEvt({...evt,powerSafety:false}).authorized,false));
test('DVT is blocked without measured EVT evidence',()=>assert.equal(authorizeDvt({evtAuthorized:true,measuredEvidence:false}).authorized,false));
test('DVT requires repeatable pass evidence and no open safety failures',()=>assert.equal(authorizeDvt({evtAuthorized:true,measuredEvidence:true,repeatablePass:true,openSafetyFailures:0}).authorized,true));