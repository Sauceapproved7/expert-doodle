import {createHash} from "node:crypto";

const OWNER="SauceApproved enterprise LLC";

const SPECS=Object.freeze([
  ["project.projectId","exact",0],
  ["project.projectVersion","exact",0],
  ["project.timelineVersion","exact",0],
  ["camera.deviceId","exact",0],
  ["camera.positionMm.x","number",5],
  ["camera.positionMm.y","number",5],
  ["camera.positionMm.z","number",5],
  ["camera.lensMm","number",0.01],
  ["camera.aperture","number",0.1],
  ["camera.iso","number",0],
  ["camera.shutterAngle","number",1],
  ["camera.fps","number",0.001],
  ["camera.whiteBalanceK","number",100],
  ["audio.deviceId","exact",0],
  ["audio.micPositionMm.x","number",10],
  ["audio.micPositionMm.y","number",10],
  ["audio.micPositionMm.z","number",10],
  ["audio.gainDb","number",0.5],
  ["audio.roomNoiseFloorDbfs","number",3],
  ["audio.roomDecayMs","number",25],
  ["infrastructure.powerProfileId","exact",0],
  ["infrastructure.cableMapVersion","exact",0],
  ["infrastructure.monitorProfileId","exact",0],
  ["teleprompter.scriptFingerprint","exact",0],
  ["teleprompter.scrollSpeed","number",1],
  ["teleprompter.mirrored","exact",0],
  ["environment.temperatureC","number",2],
  ["environment.ambientLightLux","number",15]
]);

function canonical(value){
  if(Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
  if(value && typeof value==="object"){
    return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
  }
  return JSON.stringify(value);
}

function digest(value){
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function getPath(source,path){
  return path.split(".").reduce((value,key)=>value==null?undefined:value[key],source);
}

function missing(value){
  return value===undefined || value===null || value==="";
}

function lightSpecs(state){
  const lights=Array.isArray(state?.lighting)?state.lighting:[];
  const out=[];
  for(const light of lights){
    const id=String(light?.id||"");
    if(!id) continue;
    out.push(
      [`lighting.${id}.positionMm.x`,"number",10],
      [`lighting.${id}.positionMm.y`,"number",10],
      [`lighting.${id}.positionMm.z`,"number",10],
      [`lighting.${id}.intensityPct`,"number",1],
      [`lighting.${id}.colorTemperatureK`,"number",100]
    );
  }
  return out;
}

function normalizedForComparison(state){
  const result=structuredClone(state||{});
  const lights=Array.isArray(result.lighting)?result.lighting:[];
  result.lighting=Object.fromEntries(lights.map(light=>[String(light.id||""),light]).filter(([id])=>id));
  return result;
}

function criticalPaths(state){
  const paths=SPECS.map(x=>x[0]);
  const lights=Array.isArray(state?.lighting)?state.lighting:[];
  if(lights.length===0) paths.push("lighting");
  for(const [path] of lightSpecs(state)) paths.push(path);
  return paths;
}

function assertCriticalState(state){
  const normalized=normalizedForComparison(state);
  const bad=criticalPaths(state).filter(path=>{
    if(path==="lighting") return !Array.isArray(state?.lighting)||state.lighting.length===0;
    return missing(getPath(normalized,path));
  });
  if(bad.length) {
    const error=new Error("memory_grid_critical_state_missing");
    error.missing=bad;
    throw error;
  }
}

function comparisonSpecs(referenceState,currentState){
  const referenceLights=lightSpecs(referenceState);
  const currentLights=lightSpecs(currentState);
  const seen=new Set();
  return [...SPECS,...referenceLights,...currentLights].filter(spec=>{
    if(seen.has(spec[0])) return false;
    seen.add(spec[0]);
    return true;
  });
}

function compareValue(path,mode,tolerance,referenceValue,currentValue){
  if(missing(currentValue)) return {type:"unknown",path,reference:referenceValue,current:null,tolerance};
  if(mode==="number"){
    const a=Number(referenceValue),b=Number(currentValue);
    if(!Number.isFinite(a)||!Number.isFinite(b)) return {type:"unknown",path,reference:referenceValue,current:currentValue,tolerance};
    const delta=Math.abs(a-b);
    if(delta>tolerance) return {type:"drift",path,reference:a,current:b,delta,tolerance};
    return null;
  }
  if(canonical(referenceValue)!==canonical(currentValue)) return {type:"drift",path,reference:referenceValue,current:currentValue,tolerance:0};
  return null;
}

export function createStudioMemoryGridManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.memory-grid/v1",
    product:"Hercules Studio Memory Grid",
    implementationOwner:OWNER,
    buildMode:"hercules-owned",
    sourceDivisions:Object.freeze(["creation-floor","soundworld","studio-infrastructure"]),
    externalPlatforms:Object.freeze([]),
    thirdPartyHostedRuntimeAllowed:false,
    thirdPartyProductSubstitutionAllowed:false,
    executionPolicy:"capture-compare-explain-authorize-restore-verify",
    differentiators:Object.freeze([
      "Continuity Fingerprint",
      "Delta-to-Set",
      "Blind Spot Gate",
      "Golden Take Lock"
    ]),
    safety:Object.freeze({
      automaticPhysicalMovement:false,
      unverifiedContinuityClaims:false,
      missingEvidenceFailsClosed:true,
      proofSpineRequired:true
    })
  });
}

export function captureGoldenTake({takeId,state}={}){
  if(!String(takeId||"").trim()) throw new Error("memory_grid_take_identity_required");
  assertCriticalState(state);
  const snapshot=structuredClone(state);
  const payload={takeId:String(takeId),state:snapshot};
  return Object.freeze({
    schema:"sauceapproved.studio.golden-take/v1",
    takeId:String(takeId),
    state:snapshot,
    fingerprint:digest(payload),
    proofSpine:Object.freeze({
      algorithm:"sha256",
      verifiedAtCapture:true,
      externalRuntimeRequired:false
    })
  });
}

export function verifyGoldenTake(reference){
  if(!reference?.takeId||!reference?.state||!reference?.fingerprint) return false;
  return digest({takeId:String(reference.takeId),state:reference.state})===reference.fingerprint;
}

export function compareStudioState(reference,currentState){
  if(!verifyGoldenTake(reference)) throw new Error("memory_grid_reference_invalid");
  const ref=normalizedForComparison(reference.state);
  const current=normalizedForComparison(currentState);
  const drift=[],unknown=[];
  for(const [path,mode,tolerance] of comparisonSpecs(reference.state,currentState)){
    const result=compareValue(path,mode,tolerance,getPath(ref,path),getPath(current,path));
    if(!result) continue;
    if(result.type==="drift") drift.push(Object.freeze(result));
    else unknown.push(Object.freeze(result));
  }
  const referenceLightIds=new Set((reference.state.lighting||[]).map(x=>String(x.id||"")).filter(Boolean));
  const currentLightIds=new Set((currentState?.lighting||[]).map(x=>String(x.id||"")).filter(Boolean));
  for(const id of referenceLightIds){
    if(!currentLightIds.has(id)) unknown.push(Object.freeze({type:"unknown",path:`lighting.${id}`,reference:"present",current:null,tolerance:0}));
  }
  for(const id of currentLightIds){
    if(!referenceLightIds.has(id)) drift.push(Object.freeze({type:"drift",path:`lighting.${id}`,reference:"absent",current:"present",tolerance:0}));
  }
  return Object.freeze({
    schema:"sauceapproved.studio.continuity-report/v1",
    takeId:reference.takeId,
    referenceFingerprint:reference.fingerprint,
    continuityReady:drift.length===0&&unknown.length===0,
    drift:Object.freeze(drift),
    unknown:Object.freeze(unknown),
    blindSpotGate:unknown.length===0?"clear":"blocked"
  });
}

export function buildRestorePlan(report){
  if(!report?.referenceFingerprint) throw new Error("memory_grid_report_required");
  const actions=[];
  for(const item of report.drift||[]){
    actions.push(Object.freeze({
      kind:"restore-drift",
      path:item.path,
      target:item.reference,
      observed:item.current,
      requiresAuthorization:true,
      automatic:false
    }));
  }
  for(const item of report.unknown||[]){
    actions.push(Object.freeze({
      kind:"measure-or-confirm",
      path:item.path,
      target:item.reference,
      observed:null,
      requiresAuthorization:true,
      automatic:false
    }));
  }
  return Object.freeze({
    schema:"sauceapproved.studio.restore-plan/v1",
    referenceFingerprint:report.referenceFingerprint,
    state:actions.length?"blocked-until-restored-and-verified":"ready",
    autoExecute:false,
    executionPolicy:"manual-or-authorized-control-only",
    actions:Object.freeze(actions)
  });
}
