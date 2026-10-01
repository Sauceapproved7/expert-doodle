import test from "node:test";
import assert from "node:assert/strict";
import {
  createStudioMemoryGridManifest,
  captureGoldenTake,
  verifyGoldenTake,
  compareStudioState,
  buildRestorePlan
} from "../sauceapproved-studio/memory-grid/core.mjs";

function state(overrides={}){
  return {
    project:{projectId:"proj-1",projectVersion:7,timelineVersion:11},
    camera:{
      deviceId:"cam-a",
      positionMm:{x:0,y:1500,z:3200},
      lensMm:35,
      aperture:2.8,
      iso:400,
      shutterAngle:180,
      fps:23.976,
      whiteBalanceK:5600
    },
    lighting:[
      {id:"key",positionMm:{x:-900,y:1800,z:2100},intensityPct:62,colorTemperatureK:5600},
      {id:"fill",positionMm:{x:800,y:1500,z:2300},intensityPct:28,colorTemperatureK:5600}
    ],
    audio:{
      deviceId:"soundworld-mic-1",
      micPositionMm:{x:0,y:1750,z:950},
      gainDb:34,
      roomNoiseFloorDbfs:-58,
      roomDecayMs:320
    },
    infrastructure:{
      powerProfileId:"power-a",
      cableMapVersion:"cables-v3",
      monitorProfileId:"monitor-v2"
    },
    teleprompter:{
      scriptFingerprint:"script-abc",
      scrollSpeed:42,
      mirrored:true
    },
    environment:{
      temperatureC:22,
      ambientLightLux:140
    },
    ...overrides
  };
}

test("manifest defines a Hercules-owned cross-division continuity system",()=>{
  const m=createStudioMemoryGridManifest();
  assert.equal(m.product,"Hercules Studio Memory Grid");
  assert.equal(m.implementationOwner,"SauceApproved enterprise LLC");
  assert.equal(m.buildMode,"hercules-owned");
  assert.equal(m.thirdPartyHostedRuntimeAllowed,false);
  assert.equal(m.thirdPartyProductSubstitutionAllowed,false);
  assert.deepEqual(m.sourceDivisions,["creation-floor","soundworld","studio-infrastructure"]);
  assert.ok(m.differentiators.includes("Continuity Fingerprint"));
  assert.ok(m.differentiators.includes("Delta-to-Set"));
  assert.ok(m.differentiators.includes("Blind Spot Gate"));
  assert.ok(m.differentiators.includes("Golden Take Lock"));
});

test("golden take requires complete critical studio state",()=>{
  assert.throws(()=>captureGoldenTake({takeId:"take-1",state:{project:{projectId:"proj-1"}}}),/memory_grid_critical_state_missing/);
});

test("golden take fingerprint is deterministic and verifiable",()=>{
  const a=captureGoldenTake({takeId:"take-1",state:state()});
  const reordered=captureGoldenTake({
    takeId:"take-1",
    state:{
      environment:state().environment,
      teleprompter:state().teleprompter,
      infrastructure:state().infrastructure,
      audio:state().audio,
      lighting:state().lighting,
      camera:state().camera,
      project:state().project
    }
  });
  assert.equal(a.fingerprint,reordered.fingerprint);
  assert.equal(verifyGoldenTake(a),true);
  assert.equal(verifyGoldenTake({...a,state:{...a.state,audio:{...a.state.audio,gainDb:99}}}),false);
});

test("exact recall reports continuity ready",()=>{
  const reference=captureGoldenTake({takeId:"take-1",state:state()});
  const report=compareStudioState(reference,state());
  assert.equal(report.continuityReady,true);
  assert.deepEqual(report.drift,[]);
  assert.deepEqual(report.unknown,[]);
});

test("cross-domain drift is detected instead of silently accepted",()=>{
  const reference=captureGoldenTake({takeId:"take-1",state:state()});
  const current=state({
    camera:{...state().camera,whiteBalanceK:6100},
    audio:{...state().audio,gainDb:38},
    infrastructure:{...state().infrastructure,cableMapVersion:"cables-v4"}
  });
  const report=compareStudioState(reference,current);
  assert.equal(report.continuityReady,false);
  assert.ok(report.drift.some(x=>x.path==="camera.whiteBalanceK"));
  assert.ok(report.drift.some(x=>x.path==="audio.gainDb"));
  assert.ok(report.drift.some(x=>x.path==="infrastructure.cableMapVersion"));
});

test("missing current evidence is unknown, never a false match",()=>{
  const reference=captureGoldenTake({takeId:"take-1",state:state()});
  const current=state();
  delete current.audio.roomDecayMs;
  const report=compareStudioState(reference,current);
  assert.equal(report.continuityReady,false);
  assert.ok(report.unknown.some(x=>x.path==="audio.roomDecayMs"));
});

test("restore plan stays advisory and fail-closed for physical changes",()=>{
  const reference=captureGoldenTake({takeId:"take-1",state:state()});
  const current=state({
    lighting:[{...state().lighting[0],intensityPct:45},state().lighting[1]]
  });
  const report=compareStudioState(reference,current);
  const plan=buildRestorePlan(report);
  assert.equal(plan.autoExecute,false);
  assert.equal(plan.executionPolicy,"manual-or-authorized-control-only");
  assert.ok(plan.actions.length>0);
  assert.ok(plan.actions.every(x=>x.requiresAuthorization===true));
});
