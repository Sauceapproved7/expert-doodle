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

export function createInfrastructureExpansionManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.infrastructure.production-systems/v1",
    implementationOwner:OWNER,
    buildMode:"hercules-owned",
    externalPlatforms:Object.freeze([]),
    thirdPartyHostedRuntimeAllowed:false,
    thirdPartyProductSubstitutionAllowed:false,
    systems:Object.freeze([
      system("timecode-genlock","Timecode + Genlock Backbone"),
      system("signal-routing-patching","Signal Routing + Patching"),
      system("storage-data-backbone","Storage + Data Backbone"),
      system("grip-position-tracking","Grip + Position Tracking"),
      system("acoustic-treatment","Acoustic Treatment System"),
      system("tally-intercom-slate","Tally + Intercom + Slate"),
      system("environmental-sensing","Environmental Sensing"),
      system("redundancy","Studio Redundancy"),
      system("calibration-gear","Calibration Gear Registry"),
      system("cable-power-topology","Cable + Power Topology")
    ])
  });
}

export function createSyncBackbone({id,frameRate,nodes=[]}={}){
  return Object.freeze({
    schema:"sauceapproved.studio.sync-backbone/v1",
    id:required(id,"sync_backbone_identity_required"),
    frameRate:finite(frameRate,"sync_frame_rate_required"),
    nodes:Object.freeze(nodes.map(node=>Object.freeze({
      id:required(node.id,"sync_node_identity_required"),
      timecodeLocked:node.timecodeLocked===true,
      genlockLocked:node.genlockLocked===true,
      measured:node.measured===true,
      offsetFrames:finite(node.offsetFrames??0,"invalid_sync_offset")
    }))),
    physicalBuildVerified:false
  });
}

export function evaluateSyncBackbone(backbone){
  if(!backbone?.id) throw new Error("sync_backbone_required");
  const blockers=[];
  if(!(backbone.nodes||[]).length) blockers.push("sync_node_required");
  for(const node of backbone.nodes||[]){
    if(!node.measured) blockers.push("sync_measurement_required:"+node.id);
    if(!node.timecodeLocked) blockers.push("timecode_unlock:"+node.id);
    if(!node.genlockLocked) blockers.push("genlock_unlock:"+node.id);
    if(Math.abs(node.offsetFrames)>0.25) blockers.push("sync_offset_exceeded:"+node.id);
  }
  return Object.freeze({ready:blockers.length===0,blockers:Object.freeze(blockers)});
}

export function createSignalMatrix({id,inputs=[],outputs=[]}={}){
  const inIds=[...new Set(inputs.map(String).filter(Boolean))];
  const outIds=[...new Set(outputs.map(String).filter(Boolean))];
  if(!inIds.length||!outIds.length) throw new Error("signal_matrix_io_required");
  return {
    schema:"sauceapproved.studio.signal-matrix/v1",
    id:required(id,"signal_matrix_identity_required"),
    inputs:inIds,
    outputs:outIds,
    routes:[],
    physicalBuildVerified:false
  };
}

export function routeSignal(matrix,{inputId,outputId,mixed=false}={}){
  if(!matrix?.id) throw new Error("signal_matrix_required");
  const input=required(inputId,"signal_input_required"),output=required(outputId,"signal_output_required");
  if(!matrix.inputs.includes(input)||!matrix.outputs.includes(output)) throw new Error("signal_route_endpoint_unknown");
  const existing=(matrix.routes||[]).filter(route=>route.outputId===output);
  if(existing.length&&!mixed) throw new Error("signal_output_already_routed");
  return {...matrix,routes:[...(matrix.routes||[]),{inputId:input,outputId:output,mixed:mixed===true,verified:false}]};
}

export function verifySignalRoute(matrix,{inputId,outputId,verified}={}){
  if(!matrix?.id) throw new Error("signal_matrix_required");
  let found=false;
  const routes=(matrix.routes||[]).map(route=>{
    if(route.inputId===inputId&&route.outputId===outputId){
      found=true;
      return {...route,verified:verified===true};
    }
    return route;
  });
  if(!found) throw new Error("signal_route_not_found");
  return {...matrix,routes};
}

export function evaluateSignalMatrix(matrix){
  if(!matrix?.id) throw new Error("signal_matrix_required");
  const blockers=[];
  if(!(matrix.routes||[]).length) blockers.push("signal_route_required");
  const outputs=new Map();
  for(const route of matrix.routes||[]){
    const list=outputs.get(route.outputId)||[];
    list.push(route);
    outputs.set(route.outputId,list);
  }
  for(const [output,routes] of outputs){
    if(routes.length>1&&!routes.every(route=>route.mixed===true)) blockers.push("signal_fan_in_conflict:"+output);
  }
  return Object.freeze({ready:blockers.length===0,blockers:Object.freeze(blockers)});
}

export function createStorageBackbone({id,volumes=[],minimumVerifiedCopies=2}={}){
  const copies=Math.max(1,Math.floor(finite(minimumVerifiedCopies,"invalid_verified_copy_requirement")));
  return Object.freeze({
    schema:"sauceapproved.studio.storage-backbone/v1",
    id:required(id,"storage_backbone_identity_required"),
    minimumVerifiedCopies:copies,
    volumes:Object.freeze(volumes.map(volume=>Object.freeze({
      id:required(volume.id,"storage_volume_identity_required"),
      role:required(volume.role,"storage_volume_role_required"),
      verified:volume.verified===true,
      freeBytes:finite(volume.freeBytes,"storage_free_bytes_required")
    }))),
    physicalBuildVerified:false
  });
}

export function evaluateStorageBackbone(backbone){
  if(!backbone?.id) throw new Error("storage_backbone_required");
  const verified=(backbone.volumes||[]).filter(volume=>volume.verified&&volume.freeBytes>0);
  const roles=new Set(verified.map(volume=>volume.role));
  const blockers=[];
  if(verified.length<backbone.minimumVerifiedCopies) blockers.push("insufficient_verified_copies");
  if(!roles.has("primary")) blockers.push("verified_primary_required");
  return Object.freeze({ready:blockers.length===0,verifiedCopies:verified.length,blockers:Object.freeze(blockers)});
}

export function createPositionRegistry({id,points=[]}={}){
  return Object.freeze({
    schema:"sauceapproved.studio.position-registry/v1",
    id:required(id,"position_registry_identity_required"),
    points:Object.freeze(points.map(point=>Object.freeze({
      id:required(point.id,"position_point_identity_required"),
      kind:required(point.kind,"position_point_kind_required"),
      positionMm:Object.freeze({
        x:finite(point.positionMm?.x,"position_x_required"),
        y:finite(point.positionMm?.y,"position_y_required"),
        z:finite(point.positionMm?.z,"position_z_required")
      }),
      measured:point.measured===true
    }))),
    physicalBuildVerified:false
  });
}

export function comparePositionState(reference,{points=[],toleranceMm=10}={}){
  if(!reference?.id) throw new Error("position_registry_required");
  const tolerance=Math.max(0,finite(toleranceMm,"invalid_position_tolerance"));
  const observed=new Map(points.map(point=>[String(point.id||""),point]));
  const drift=[],unknown=[];
  for(const point of reference.points||[]){
    const current=observed.get(point.id);
    if(!current||current.measured!==true){
      unknown.push({id:point.id,reason:"position_measurement_required"});
      continue;
    }
    const deltas={
      x:Math.abs(finite(current.positionMm?.x,"position_x_required")-point.positionMm.x),
      y:Math.abs(finite(current.positionMm?.y,"position_y_required")-point.positionMm.y),
      z:Math.abs(finite(current.positionMm?.z,"position_z_required")-point.positionMm.z)
    };
    if(Math.max(deltas.x,deltas.y,deltas.z)>tolerance) drift.push({id:point.id,deltas,toleranceMm:tolerance});
  }
  return Object.freeze({ready:drift.length===0&&unknown.length===0,drift:Object.freeze(drift),unknown:Object.freeze(unknown)});
}

export function createAcousticTreatmentPlan({id,roomId,targets={},elements=[]}={}){
  return Object.freeze({
    schema:"sauceapproved.studio.acoustic-treatment/v1",
    id:required(id,"treatment_plan_identity_required"),
    roomId:required(roomId,"treatment_room_required"),
    targets:Object.freeze({
      rt60Ms:finite(targets.rt60Ms,"treatment_rt60_target_required"),
      noiseFloorDbSpl:finite(targets.noiseFloorDbSpl,"treatment_noise_target_required")
    }),
    elements:Object.freeze(elements.map(element=>Object.freeze({
      id:required(element.id,"treatment_element_identity_required"),
      kind:required(element.kind,"treatment_element_kind_required"),
      location:required(element.location,"treatment_element_location_required")
    }))),
    measurement:null,
    physicalBuildVerified:false
  });
}

export function attachTreatmentMeasurement(plan,{rt60Ms,noiseFloorDbSpl,measured}={}){
  if(!plan?.id) throw new Error("treatment_plan_required");
  return {...plan,measurement:{rt60Ms:finite(rt60Ms,"treatment_rt60_measurement_required"),noiseFloorDbSpl:finite(noiseFloorDbSpl,"treatment_noise_measurement_required"),measured:measured===true}};
}

export function evaluateTreatmentPlan(plan){
  if(!plan?.id) throw new Error("treatment_plan_required");
  const blockers=[];
  if(!(plan.elements||[]).length) blockers.push("treatment_element_required");
  if(plan.measurement?.measured!==true) blockers.push("post_treatment_measurement_required");
  else{
    if(plan.measurement.rt60Ms>plan.targets.rt60Ms) blockers.push("rt60_target_not_met");
    if(plan.measurement.noiseFloorDbSpl>plan.targets.noiseFloorDbSpl) blockers.push("noise_floor_target_not_met");
  }
  return Object.freeze({ready:blockers.length===0,blockers:Object.freeze(blockers)});
}

export function createCommsSlateSession({id,projectId,shotId,channels=[]}={}){
  const unique=[...new Set(channels.map(String).filter(Boolean))];
  if(!unique.length) throw new Error("intercom_channel_required");
  return Object.freeze({
    schema:"sauceapproved.studio.comms-slate/v1",
    id:required(id,"comms_session_identity_required"),
    projectId:required(projectId,"comms_project_required"),
    slate:Object.freeze({shotId:required(shotId,"slate_shot_required"),take:null,marked:false}),
    tally:Object.freeze({recording:false,live:false}),
    intercom:Object.freeze({channels:Object.freeze(unique),verified:false}),
    physicalBuildVerified:false
  });
}

export function createEnvironmentBaseline({id,ranges={}}={}){
  const normalized={};
  for(const key of ["temperatureC","humidityPct","ambientLux","noiseFloorDbSpl"]){
    const range=ranges[key];
    if(!Array.isArray(range)||range.length!==2) throw new Error("environment_range_required:"+key);
    normalized[key]=Object.freeze([finite(range[0],"invalid_environment_range"),finite(range[1],"invalid_environment_range")]);
  }
  return Object.freeze({schema:"sauceapproved.studio.environment-baseline/v1",id:required(id,"environment_baseline_identity_required"),ranges:Object.freeze(normalized),physicalBuildVerified:false});
}

export function evaluateEnvironment(baseline,measurement={}){
  if(!baseline?.id) throw new Error("environment_baseline_required");
  const unknown=[],outOfRange=[];
  for(const [key,[min,max]] of Object.entries(baseline.ranges||{})){
    if(measurement.measured!==true||!Number.isFinite(Number(measurement[key]))){
      unknown.push(key);
      continue;
    }
    const value=Number(measurement[key]);
    if(value<min||value>max) outOfRange.push(key);
  }
  return Object.freeze({ready:unknown.length===0&&outOfRange.length===0,unknown:Object.freeze(unknown),outOfRange:Object.freeze(outOfRange)});
}

export function createRedundancyPlan({id,services=[]}={}){
  return Object.freeze({
    schema:"sauceapproved.studio.redundancy-plan/v1",
    id:required(id,"redundancy_plan_identity_required"),
    services:Object.freeze(services.map(service=>Object.freeze({
      id:required(service.id,"redundancy_service_identity_required"),
      paths:Object.freeze([...new Set((service.paths||[]).map(String).filter(Boolean))])
    }))),
    physicalBuildVerified:false
  });
}

export function evaluateRedundancyPlan(plan){
  if(!plan?.id) throw new Error("redundancy_plan_required");
  const single=(plan.services||[]).filter(service=>service.paths.length<2).map(service=>service.id).sort();
  return Object.freeze({ready:single.length===0,singlePointsOfFailure:Object.freeze(single)});
}

export function createCalibrationRegistry({id}={}){
  return {schema:"sauceapproved.studio.calibration-registry/v1",id:required(id,"calibration_registry_identity_required"),records:[],physicalBuildVerified:false};
}

export function registerCalibration(registry,{deviceId,kind,calibratedAt,validUntil,artifactSha256}={}){
  if(!registry?.id) throw new Error("calibration_registry_required");
  const start=Date.parse(required(calibratedAt,"calibration_time_required"));
  const end=Date.parse(required(validUntil,"calibration_expiration_required"));
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start) throw new Error("invalid_calibration_window");
  if(!validSha256(artifactSha256)) throw new Error("calibration_artifact_fingerprint_required");
  const id=required(deviceId,"calibration_device_required");
  const record={deviceId:id,kind:required(kind,"calibration_kind_required"),calibratedAt,validUntil,artifactSha256:String(artifactSha256).toLowerCase()};
  return {...registry,records:[...(registry.records||[]).filter(x=>x.deviceId!==id),record]};
}

export function evaluateCalibrationRegistry(registry,{asOf}={}){
  if(!registry?.id) throw new Error("calibration_registry_required");
  const when=Date.parse(required(asOf,"calibration_evaluation_time_required"));
  if(!Number.isFinite(when)) throw new Error("invalid_calibration_evaluation_time");
  const expired=(registry.records||[]).filter(record=>when>=Date.parse(record.validUntil)).map(record=>record.deviceId).sort();
  const blockers=[];
  if(!(registry.records||[]).length) blockers.push("calibration_record_required");
  for(const id of expired) blockers.push("calibration_expired:"+id);
  return Object.freeze({ready:blockers.length===0,expired:Object.freeze(expired),blockers:Object.freeze(blockers)});
}

export function createCablePowerTopology({id,circuits=[],devices=[],signalPaths=[]}={}){
  return Object.freeze({
    schema:"sauceapproved.studio.cable-power-topology/v1",
    id:required(id,"topology_identity_required"),
    circuits:Object.freeze(circuits.map(c=>Object.freeze({id:required(c.id,"circuit_identity_required"),maxWatts:finite(c.maxWatts,"circuit_capacity_required")}))),
    devices:Object.freeze(devices.map(d=>Object.freeze({id:required(d.id,"power_device_identity_required"),watts:finite(d.watts,"power_device_watts_required"),circuitId:required(d.circuitId,"power_device_circuit_required")}))),
    signalPaths:Object.freeze(signalPaths.map(p=>Object.freeze({id:required(p.id,"signal_path_identity_required"),source:required(p.source,"signal_path_source_required"),destination:required(p.destination,"signal_path_destination_required"),verified:p.verified===true}))),
    physicalBuildVerified:false
  });
}

export function evaluateCablePowerTopology(topology){
  if(!topology?.id) throw new Error("topology_required");
  const blockers=[];
  const capacities=new Map((topology.circuits||[]).map(c=>[c.id,c.maxWatts]));
  const loads=new Map();
  for(const device of topology.devices||[]){
    if(!capacities.has(device.circuitId)){
      blockers.push("unknown_circuit:"+device.id);
      continue;
    }
    loads.set(device.circuitId,(loads.get(device.circuitId)||0)+device.watts);
  }
  for(const [circuitId,load] of loads){
    if(load>capacities.get(circuitId)) blockers.push("circuit_overload:"+circuitId);
  }
  for(const path of topology.signalPaths||[]){
    if(!path.verified) blockers.push("unverified_signal_path:"+path.id);
  }
  return Object.freeze({ready:blockers.length===0,blockers:Object.freeze(blockers),loads:Object.freeze(Object.fromEntries(loads))});
}
