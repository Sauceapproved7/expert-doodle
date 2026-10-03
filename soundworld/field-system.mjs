const OWNER="SauceApproved enterprise LLC";

const system=(id,label)=>Object.freeze({
  id,label,
  implementationOwner:OWNER,
  herculesOwned:true,
  outsidePlatformAllowed:false,
  physicalBuildVerified:false
});

function required(value,code){
  if(!String(value||"").trim()) throw new Error(code);
  return String(value).trim();
}

function finite(value,code){
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error(code);
  return n;
}

function validSha256(value){
  return /^[a-f0-9]{64}$/i.test(String(value||""));
}

export function createSoundWorldExpansionManifest(){
  return Object.freeze({
    schema:"sauceapproved.soundworld.field-system/v1",
    implementationOwner:OWNER,
    buildMode:"hercules-owned",
    externalPlatforms:Object.freeze([]),
    thirdPartyHostedRuntimeAllowed:false,
    thirdPartyProductSubstitutionAllowed:false,
    systems:Object.freeze([
      system("multitrack-field-recorder","SoundWorld Field Recorder"),
      system("wireless-creator-lav","SoundWorld Wireless Creator Set"),
      system("room-reference-calibration","SoundWorld Room Reference"),
      system("timecode-audio-clock","SoundWorld Clock"),
      system("repair-calibration-station","SoundWorld Service Bench"),
      system("room-acoustic-measurement","SoundWorld Room Measure")
    ])
  });
}

function recorderBlockers(session){
  const blockers=[];
  if(!(session.tracks||[]).length) blockers.push("armed_track_required");
  if(session.clockEvidence?.measured!==true||session.clockEvidence?.locked!==true) blockers.push("clock_lock_evidence_required");
  if(session.storageEvidence?.verified!==true) blockers.push("verified_storage_required");
  return blockers;
}

export function createFieldRecorderSession({id,projectId,sampleRateHz=48000,bitDepth=24}={}){
  const sr=finite(sampleRateHz,"invalid_sample_rate"),depth=finite(bitDepth,"invalid_bit_depth");
  if(![44100,48000,88200,96000,192000].includes(sr)) throw new Error("unsupported_sample_rate");
  if(![16,24,32].includes(depth)) throw new Error("unsupported_bit_depth");
  const session={
    schema:"sauceapproved.soundworld.field-recorder/v1",
    id:required(id,"recorder_identity_required"),
    projectId:required(projectId,"recorder_project_required"),
    sampleRateHz:sr,
    bitDepth:depth,
    tracks:[],
    clockEvidence:null,
    storageEvidence:null,
    autonomousRecordStart:false
  };
  const blockers=recorderBlockers(session);
  return {...session,recordReady:false,blockers};
}

export function armRecorderTrack(session,{trackId,inputId,name,phantomPower=false,limiterEnabled=true}={}){
  if(!session?.id) throw new Error("recorder_session_required");
  const id=required(trackId,"recorder_track_required");
  if((session.tracks||[]).some(track=>track.trackId===id)) throw new Error("recorder_track_already_exists");
  const next={
    ...session,
    tracks:[...(session.tracks||[]),{
      trackId:id,
      inputId:required(inputId,"recorder_input_required"),
      name:required(name,"recorder_track_name_required"),
      phantomPower:phantomPower===true,
      limiterEnabled:limiterEnabled!==false,
      armed:true
    }]
  };
  const blockers=recorderBlockers(next);
  return {...next,recordReady:blockers.length===0,blockers};
}

export function attachRecorderClockEvidence(session,{clockDomainId,measured,locked,offsetFrames=0}={}){
  if(!session?.id) throw new Error("recorder_session_required");
  const next={
    ...session,
    clockEvidence:{
      clockDomainId:required(clockDomainId,"clock_domain_required"),
      measured:measured===true,
      locked:locked===true,
      offsetFrames:finite(offsetFrames,"invalid_clock_offset")
    }
  };
  const blockers=recorderBlockers(next);
  return {...next,recordReady:blockers.length===0,blockers};
}

export function attachRecorderStorageEvidence(session,{storageId,verified,minimumFreeBytes,observedFreeBytes}={}){
  if(!session?.id) throw new Error("recorder_session_required");
  const requiredBytes=finite(minimumFreeBytes,"invalid_storage_requirement");
  const observed=finite(observedFreeBytes,"invalid_storage_observation");
  const ok=verified===true&&observed>=requiredBytes;
  const next={
    ...session,
    storageEvidence:{
      storageId:required(storageId,"storage_identity_required"),
      verified:ok,
      minimumFreeBytes:requiredBytes,
      observedFreeBytes:observed
    }
  };
  const blockers=recorderBlockers(next);
  return {...next,recordReady:blockers.length===0,blockers};
}

export function createWirelessCreatorSet({id,transmitters=[],receiverId}={}){
  const tx=[...new Set(transmitters.map(String).filter(Boolean))];
  if(!tx.length) throw new Error("wireless_transmitter_required");
  return {
    schema:"sauceapproved.soundworld.wireless-creator/v1",
    id:required(id,"wireless_set_identity_required"),
    transmitters:tx,
    receiverId:required(receiverId,"wireless_receiver_required"),
    links:{},
    linkVerified:false,
    autonomousFrequencyChange:false,
    physicalBuildVerified:false
  };
}

export function registerWirelessLinkEvidence(set,{transmitterId,rssiDbm,packetLossPct,latencyMs,measured}={}){
  if(!set?.id) throw new Error("wireless_set_required");
  const tx=required(transmitterId,"wireless_transmitter_required");
  if(!set.transmitters.includes(tx)) throw new Error("wireless_transmitter_not_in_set");
  const evidence={
    rssiDbm:finite(rssiDbm,"invalid_wireless_rssi"),
    packetLossPct:finite(packetLossPct,"invalid_wireless_packet_loss"),
    latencyMs:finite(latencyMs,"invalid_wireless_latency"),
    measured:measured===true
  };
  const links={...(set.links||{}),[tx]:evidence};
  const allVerified=set.transmitters.every(id=>{
    const link=links[id];
    return link?.measured===true&&link.rssiDbm>=-75&&link.packetLossPct<=1&&link.latencyMs<=15;
  });
  return {...set,links,linkVerified:allVerified};
}

export function createRoomCalibrationProfile({id,target={},tolerance={}}={}){
  return Object.freeze({
    schema:"sauceapproved.soundworld.room-reference/v1",
    id:required(id,"room_profile_identity_required"),
    target:Object.freeze({
      levelDbSpl:finite(target.levelDbSpl,"room_target_level_required"),
      noiseFloorDbSpl:finite(target.noiseFloorDbSpl,"room_target_noise_required"),
      decayMs:finite(target.decayMs,"room_target_decay_required")
    }),
    tolerance:Object.freeze({
      levelDb:Math.max(0,finite(tolerance.levelDb,"room_level_tolerance_required")),
      noiseFloorDb:Math.max(0,finite(tolerance.noiseFloorDb,"room_noise_tolerance_required")),
      decayMs:Math.max(0,finite(tolerance.decayMs,"room_decay_tolerance_required"))
    }),
    physicalBuildVerified:false
  });
}

export function evaluateRoomCalibration(profile,measurement={}){
  if(!profile?.id) throw new Error("room_profile_required");
  const blockers=[];
  if(measurement.measured!==true) blockers.push("measured_room_reference_required");
  const checks=[
    ["levelDbSpl","levelDb"],
    ["noiseFloorDbSpl","noiseFloorDb"],
    ["decayMs","decayMs"]
  ];
  const deltas={};
  for(const [field,tol] of checks){
    const observed=Number(measurement[field]);
    if(!Number.isFinite(observed)){
      blockers.push("room_measurement_missing:"+field);
      continue;
    }
    const delta=Math.abs(observed-profile.target[field]);
    deltas[field]=delta;
    if(delta>profile.tolerance[tol]) blockers.push("room_reference_out_of_tolerance:"+field);
  }
  return Object.freeze({
    ready:blockers.length===0,
    blockers:Object.freeze(blockers),
    deltas:Object.freeze(deltas),
    measured:measurement.measured===true
  });
}

export function createClockDomain({id,frameRate,sampleRateHz,participants=[]}={}){
  const fps=finite(frameRate,"clock_frame_rate_required");
  const sr=finite(sampleRateHz,"clock_sample_rate_required");
  return Object.freeze({
    schema:"sauceapproved.soundworld.clock-domain/v1",
    id:required(id,"clock_domain_identity_required"),
    frameRate:fps,
    sampleRateHz:sr,
    participants:Object.freeze(participants.map(p=>Object.freeze({
      id:required(p.id,"clock_participant_required"),
      role:required(p.role,"clock_role_required"),
      locked:p.locked===true,
      measured:p.measured!==false,
      offsetFrames:finite(p.offsetFrames??0,"invalid_clock_offset")
    }))),
    physicalBuildVerified:false
  });
}

export function evaluateClockDomain(domain){
  if(!domain?.id) throw new Error("clock_domain_required");
  const blockers=[];
  if(!(domain.participants||[]).length) blockers.push("clock_participant_required");
  for(const p of domain.participants||[]){
    if(p.measured!==true) blockers.push("clock_measurement_required:"+p.id);
    if(p.locked!==true) blockers.push("clock_unlock:"+p.id);
    if(Math.abs(Number(p.offsetFrames))>0.25) blockers.push("clock_offset_exceeded:"+p.id);
  }
  return Object.freeze({ready:blockers.length===0,blockers:Object.freeze(blockers)});
}

function serviceRequirements(deviceType){
  if(deviceType==="microphone") return ["frequency-response","self-noise"];
  if(deviceType==="headphone") return ["frequency-response","channel-match"];
  if(deviceType==="speaker") return ["frequency-response","output-level"];
  if(deviceType==="recorder") return ["input-gain","clock"];
  return ["functional-test"];
}

export function createServiceRecord({id,deviceId,deviceType}={}){
  const type=required(deviceType,"service_device_type_required");
  return {
    schema:"sauceapproved.soundworld.service-record/v1",
    id:required(id,"service_record_identity_required"),
    deviceId:required(deviceId,"service_device_required"),
    deviceType:type,
    requiredEvidence:serviceRequirements(type),
    evidence:[],
    releaseReady:false,
    physicalServiceCompleted:false
  };
}

export function addCalibrationEvidence(record,{kind,measured,passed,artifactSha256}={}){
  if(!record?.id) throw new Error("service_record_required");
  const k=required(kind,"calibration_kind_required");
  if(!validSha256(artifactSha256)) throw new Error("calibration_artifact_fingerprint_required");
  const evidence=[
    ...(record.evidence||[]).filter(x=>x.kind!==k),
    {kind:k,measured:measured===true,passed:passed===true,artifactSha256:String(artifactSha256).toLowerCase()}
  ];
  const releaseReady=(record.requiredEvidence||[]).every(req=>evidence.some(x=>x.kind===req&&x.measured&&x.passed));
  return {...record,evidence,releaseReady,physicalServiceCompleted:releaseReady};
}

export function analyzeRoomAcoustics({roomId,measured,rt60MsByBand={},noiseFloorDbSpl}={}){
  required(roomId,"room_identity_required");
  const findings=[];
  if(measured!==true) findings.push("instrumented_room_measurement_required");
  const targetMax=450;
  for(const [band,value] of Object.entries(rt60MsByBand||{})){
    const n=Number(value);
    if(!Number.isFinite(n)) findings.push("invalid_rt60:"+band);
    else if(n>targetMax) findings.push("excess_decay:"+band);
  }
  const noise=Number(noiseFloorDbSpl);
  if(!Number.isFinite(noise)) findings.push("noise_floor_measurement_required");
  else if(noise>35) findings.push("noise_floor_high");
  return Object.freeze({
    schema:"sauceapproved.soundworld.room-acoustics/v1",
    roomId,
    measured:measured===true,
    ready:measured===true&&findings.length===0,
    findings:Object.freeze(findings),
    autoPhysicalCorrection:false,
    recommendationsOnly:true
  });
}
