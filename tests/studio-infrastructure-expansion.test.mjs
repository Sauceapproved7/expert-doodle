import test from "node:test";
import assert from "node:assert/strict";
import {
  createInfrastructureExpansionManifest,
  createSyncBackbone,
  evaluateSyncBackbone,
  createSignalMatrix,
  routeSignal,
  evaluateSignalMatrix,
  createStorageBackbone,
  evaluateStorageBackbone,
  createPositionRegistry,
  comparePositionState,
  createAcousticTreatmentPlan,
  evaluateTreatmentPlan,
  createCommsSlateSession,
  createEnvironmentBaseline,
  evaluateEnvironment,
  createRedundancyPlan,
  evaluateRedundancyPlan,
  createCalibrationRegistry,
  registerCalibration,
  evaluateCalibrationRegistry,
  createCablePowerTopology,
  evaluateCablePowerTopology
} from "../sauceapproved-studio/infrastructure/production-systems.mjs";

test("Studio Infrastructure expansion defines all ten missing systems",()=>{
  const m=createInfrastructureExpansionManifest();
  assert.deepEqual(m.systems.map(x=>x.id),[
    "timecode-genlock","signal-routing-patching","storage-data-backbone",
    "grip-position-tracking","acoustic-treatment","tally-intercom-slate",
    "environmental-sensing","redundancy","calibration-gear","cable-power-topology"
  ]);
  for(const x of m.systems){
    assert.equal(x.herculesOwned,true);
    assert.equal(x.outsidePlatformAllowed,false);
    assert.equal(x.physicalBuildVerified,false);
  }
});

test("timecode/genlock backbone requires measured lock across every node",()=>{
  const b=createSyncBackbone({
    id:"sync-1",frameRate:23.976,
    nodes:[
      {id:"cam-a",timecodeLocked:true,genlockLocked:true,measured:true,offsetFrames:0},
      {id:"rec-a",timecodeLocked:true,genlockLocked:false,measured:true,offsetFrames:0}
    ]
  });
  assert.equal(evaluateSyncBackbone(b).ready,false);
});

test("signal matrix rejects fan-in conflicts unless explicitly mixed",()=>{
  let m=createSignalMatrix({id:"mx-1",inputs:["cam-a","cam-b"],outputs:["monitor-a"]});
  m=routeSignal(m,{inputId:"cam-a",outputId:"monitor-a"});
  assert.throws(()=>routeSignal(m,{inputId:"cam-b",outputId:"monitor-a"}),/signal_output_already_routed/);
  assert.equal(evaluateSignalMatrix(m).ready,true);
});

test("storage backbone requires at least two verified copies before ingest is protected",()=>{
  const b=createStorageBackbone({
    id:"store-1",
    volumes:[
      {id:"primary",role:"primary",verified:true,freeBytes:2_000_000_000},
      {id:"mirror",role:"mirror",verified:false,freeBytes:2_000_000_000}
    ],
    minimumVerifiedCopies:2
  });
  assert.equal(evaluateStorageBackbone(b).ready,false);
});

test("position tracking compares measured camera grip and microphone locations",()=>{
  const r=createPositionRegistry({
    id:"pos-1",
    points:[
      {id:"camera-a",kind:"camera",positionMm:{x:0,y:1500,z:3200},measured:true},
      {id:"boom-a",kind:"microphone",positionMm:{x:50,y:1900,z:900},measured:true}
    ]
  });
  const c=comparePositionState(r,{
    points:[
      {id:"camera-a",kind:"camera",positionMm:{x:2,y:1501,z:3203},measured:true},
      {id:"boom-a",kind:"microphone",positionMm:{x:80,y:1900,z:900},measured:true}
    ],
    toleranceMm:10
  });
  assert.equal(c.ready,false);
  assert.ok(c.drift.some(x=>x.id==="boom-a"));
});

test("acoustic treatment plan stays unverified until measured room result exists",()=>{
  const p=createAcousticTreatmentPlan({
    id:"treat-1",
    roomId:"room-a",
    targets:{rt60Ms:350,noiseFloorDbSpl:30},
    elements:[{id:"panel-1",kind:"broadband-panel",location:"front-wall"}]
  });
  assert.equal(evaluateTreatmentPlan(p).ready,false);
});

test("tally intercom slate session preserves shot and communications identity",()=>{
  const s=createCommsSlateSession({id:"comms-1",projectId:"p1",shotId:"s1",channels:["director","camera","audio"]});
  assert.equal(s.slate.shotId,"s1");
  assert.equal(s.tally.recording,false);
  assert.equal(s.intercom.channels.length,3);
});

test("environment sensor evaluation blocks on missing measured channels",()=>{
  const b=createEnvironmentBaseline({
    id:"env-1",
    ranges:{temperatureC:[18,26],humidityPct:[30,60],ambientLux:[0,250],noiseFloorDbSpl:[0,35]}
  });
  const r=evaluateEnvironment(b,{temperatureC:22,humidityPct:45,ambientLux:100,measured:true});
  assert.equal(r.ready,false);
  assert.ok(r.unknown.includes("noiseFloorDbSpl"));
});

test("redundancy plan exposes single points of failure",()=>{
  const p=createRedundancyPlan({
    id:"red-1",
    services:[
      {id:"recording-power",paths:["ups-a","mains-a"]},
      {id:"project-storage",paths:["primary-only"]}
    ]
  });
  const r=evaluateRedundancyPlan(p);
  assert.equal(r.ready,false);
  assert.deepEqual(r.singlePointsOfFailure,["project-storage"]);
});

test("calibration registry blocks expired instruments",()=>{
  let r=createCalibrationRegistry({id:"cal-1"});
  r=registerCalibration(r,{deviceId:"meter-1",kind:"light-meter",calibratedAt:"2026-01-01T00:00:00Z",validUntil:"2026-07-01T00:00:00Z",artifactSha256:"a".repeat(64)});
  const e=evaluateCalibrationRegistry(r,{asOf:"2026-08-01T00:00:00Z"});
  assert.equal(e.ready,false);
  assert.deepEqual(e.expired,["meter-1"]);
});

test("cable and power topology blocks overloads and unknown routes",()=>{
  const t=createCablePowerTopology({
    id:"topo-1",
    circuits:[{id:"c1",maxWatts:1800}],
    devices:[
      {id:"light-a",watts:900,circuitId:"c1"},
      {id:"light-b",watts:1000,circuitId:"c1"}
    ],
    signalPaths:[{id:"sig-1",source:"cam-a",destination:"monitor-a",verified:false}]
  });
  const r=evaluateCablePowerTopology(t);
  assert.equal(r.ready,false);
  assert.ok(r.blockers.includes("circuit_overload:c1"));
  assert.ok(r.blockers.includes("unverified_signal_path:sig-1"));
});
