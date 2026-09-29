import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePodsSubsystem} from '../hardware/soundworld/wearables/pods-subsystem-v1.mjs';
import {evaluateMaxSubsystem} from '../hardware/soundworld/wearables/max-subsystem-v1.mjs';
const p={audioPlatform:'QCC7226',driverClass:'micro-dynamic',hybridAnc:true,voiceMic:true,cellClass:'miniature-rechargeable',ownedCase:true,usbC:true,thermalProtection:true,signedFirmware:true};
const m={audioPlatform:'QCC7226',driverClass:'large-dynamic',hybridAnc:true,beamforming:true,serviceBattery:true,usbC:true,wiredFallback:true,thermalProtection:true,signedFirmware:true};
test('Pods subsystem freezes architecture but not EVT',()=>{const r=evaluatePodsSubsystem(p);assert.equal(r.architectureFrozen,true);assert.equal(r.evtReady,false)});
test('Max subsystem freezes architecture but not EVT',()=>{const r=evaluateMaxSubsystem(m);assert.equal(r.architectureFrozen,true);assert.equal(r.evtReady,false)});
test('Pods rejects cylindrical speaker-cell assumption',()=>assert.equal(evaluatePodsSubsystem({...p,cellClass:'21700'}).architectureFrozen,false));
test('neither authorizes production',()=>{assert.equal(evaluatePodsSubsystem(p).productionReady,false);assert.equal(evaluateMaxSubsystem(m).productionReady,false)});