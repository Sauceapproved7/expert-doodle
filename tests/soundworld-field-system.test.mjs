import test from "node:test";
import assert from "node:assert/strict";
import {
  createSoundWorldExpansionManifest,
  createFieldRecorderSession,
  armRecorderTrack,
  createWirelessCreatorSet,
  registerWirelessLinkEvidence,
  createRoomCalibrationProfile,
  evaluateRoomCalibration,
  createClockDomain,
  evaluateClockDomain,
  createServiceRecord,
  addCalibrationEvidence,
  analyzeRoomAcoustics
} from "../soundworld/field-system.mjs";

test("SoundWorld expansion defines all six missing systems",()=>{
  const m=createSoundWorldExpansionManifest();
  assert.deepEqual(m.systems.map(x=>x.id),[
    "multitrack-field-recorder","wireless-creator-lav","room-reference-calibration",
    "timecode-audio-clock","repair-calibration-station","room-acoustic-measurement"
  ]);
  for(const x of m.systems){
    assert.equal(x.herculesOwned,true);
    assert.equal(x.outsidePlatformAllowed,false);
    assert.equal(x.physicalBuildVerified,false);
  }
});

test("field recorder requires independent armed tracks and fail-closed clock evidence",()=>{
  let s=createFieldRecorderSession({id:"rec-1",projectId:"p1",sampleRateHz:48000,bitDepth:24});
  s=armRecorderTrack(s,{trackId:"boom",inputId:"mic-1",name:"Boom"});
  s=armRecorderTrack(s,{trackId:"lav-a",inputId:"rx-1",name:"Lav A"});
  assert.equal(s.tracks.length,2);
  assert.equal(s.recordReady,false);
  assert.ok(s.blockers.includes("clock_lock_evidence_required"));
});

test("wireless set does not claim a verified RF path without measurements",()=>{
  let set=createWirelessCreatorSet({id:"wl-1",transmitters:["tx-a","tx-b"],receiverId:"rx-1"});
  assert.equal(set.linkVerified,false);
  set=registerWirelessLinkEvidence(set,{transmitterId:"tx-a",rssiDbm:-52,packetLossPct:0.1,latencyMs:4.2,measured:true});
  assert.equal(set.links["tx-a"].measured,true);
  assert.equal(set.linkVerified,false);
});

test("room calibration compares measured reference against target",()=>{
  const p=createRoomCalibrationProfile({
    id:"room-a",
    target:{levelDbSpl:79,noiseFloorDbSpl:28,decayMs:300},
    tolerance:{levelDb:1.5,noiseFloorDb:3,decayMs:40}
  });
  const r=evaluateRoomCalibration(p,{levelDbSpl:80,noiseFloorDbSpl:29,decayMs:325,measured:true});
  assert.equal(r.ready,true);
});

test("clock domain fails closed when any participant is unlocked",()=>{
  const c=createClockDomain({
    id:"clock-a",
    frameRate:23.976,
    sampleRateHz:48000,
    participants:[
      {id:"camera-a",role:"timecode",locked:true,offsetFrames:0},
      {id:"recorder-a",role:"audio-clock",locked:false,offsetFrames:0}
    ]
  });
  assert.equal(evaluateClockDomain(c).ready,false);
});

test("service calibration record requires evidence before release",()=>{
  let r=createServiceRecord({id:"svc-1",deviceId:"sw-mic-1",deviceType:"microphone"});
  assert.equal(r.releaseReady,false);
  r=addCalibrationEvidence(r,{kind:"frequency-response",measured:true,passed:true,artifactSha256:"d".repeat(64)});
  r=addCalibrationEvidence(r,{kind:"self-noise",measured:true,passed:true,artifactSha256:"e".repeat(64)});
  assert.equal(r.releaseReady,true);
});

test("room acoustic measurement reports untreated problems without pretending hardware correction",()=>{
  const r=analyzeRoomAcoustics({
    roomId:"room-a",
    measured:true,
    rt60MsByBand:{125:720,250:610,500:460,1000:390,2000:350,4000:330},
    noiseFloorDbSpl:37
  });
  assert.equal(r.measured,true);
  assert.equal(r.ready,false);
  assert.ok(r.findings.length>0);
  assert.equal(r.autoPhysicalCorrection,false);
});
