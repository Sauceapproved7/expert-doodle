import {createCreationFloorManifest} from "../creation-floor/core.mjs";
import {createCreationFloorExpansionManifest} from "../creation-floor/production-ops.mjs";
import {createSoundWorldFamily} from "../../soundworld/product-family.mjs";
import {createSoundWorldExpansionManifest} from "../../soundworld/field-system.mjs";
import {createStudioInfrastructureManifest} from "../infrastructure/core.mjs";
import {createInfrastructureExpansionManifest} from "../infrastructure/production-systems.mjs";
import {createStudioMemoryGridManifest} from "../memory-grid/core.mjs";
import {createGlobalStudioClosureManifest} from "../global-closure/core.mjs";
import {createStudioHardwareEngineeringProgram} from "../../hardware/studio-gap-closure/program.mjs";

const MANIFEST_FACTORIES=Object.freeze({
 "creation-floor":createCreationFloorManifest,
 "creation-floor-production-ops":createCreationFloorExpansionManifest,
 "soundworld":createSoundWorldFamily,
 "soundworld-field-system":createSoundWorldExpansionManifest,
 "studio-infrastructure":createStudioInfrastructureManifest,
 "studio-infrastructure-production":createInfrastructureExpansionManifest,
 "studio-memory-grid":createStudioMemoryGridManifest,
 "studio-global-closure":createGlobalStudioClosureManifest,
 "hardware-engineering-program":createStudioHardwareEngineeringProgram
});

const OWNER="SauceApproved enterprise LLC";
const sha=v=>/^[a-f0-9]{64}$/i.test(String(v||""));
const system=(id,label,source,kind,manifestExport)=>Object.freeze({id,label,source,kind,manifestExport,implementationOwner:OWNER,herculesOwned:true,externalRuntimeRequired:false});
export function createStudioSystemRegistry(){
 return Object.freeze({
  schema:"sauceapproved.studio.system-registry/v1",
  implementationOwner:OWNER,
  buildMode:"hercules-owned",
  externalPlatforms:Object.freeze([]),
  executionPolicy:"inventory-evidence-evaluate-authorize-release",
  systems:Object.freeze([
   system("creation-floor","Creation Floor","sauceapproved-studio/creation-floor/core.mjs","software","createCreationFloorManifest"),
   system("creation-floor-production-ops","Creation Floor Production Ops","sauceapproved-studio/creation-floor/production-ops.mjs","software","createCreationFloorExpansionManifest"),
   system("soundworld","SoundWorld Product Family","soundworld/product-family.mjs","software-hardware-contract","createSoundWorldFamily"),
   system("soundworld-field-system","SoundWorld Field System","soundworld/field-system.mjs","software-hardware-contract","createSoundWorldExpansionManifest"),
   system("studio-infrastructure","Studio Infrastructure","sauceapproved-studio/infrastructure/core.mjs","software-hardware-contract","createStudioInfrastructureManifest"),
   system("studio-infrastructure-production","Studio Infrastructure Production Systems","sauceapproved-studio/infrastructure/production-systems.mjs","software-hardware-contract","createInfrastructureExpansionManifest"),
   system("studio-memory-grid","Studio Memory Grid","sauceapproved-studio/memory-grid/core.mjs","software","createStudioMemoryGridManifest"),
   system("studio-global-closure","Studio Global Closure + Release Truth Room","sauceapproved-studio/global-closure/core.mjs","software","createGlobalStudioClosureManifest"),
   system("hardware-engineering-program","Studio Hardware Engineering Program","hardware/studio-gap-closure/program.mjs","physical-engineering-contract","createStudioHardwareEngineeringProgram")
  ]),
  releasePolicy:Object.freeze({failClosed:true,physicalClaimsRequirePhysicalEvidence:true,ownerApprovalRequired:true,syntheticEvidenceAllowed:false})
 });
}
export function evaluateStudioSystemRegistry(registry,evidence={}){
 const blocked=[],receipts=[];
 for(const s of registry.systems){
  const e=evidence[s.id];
  if(e?.verified!==true||e?.current!==true||!sha(e?.artifactSha256)) blocked.push(s.id);
  else receipts.push(Object.freeze({systemId:s.id,artifactSha256:String(e.artifactSha256).toLowerCase()}));
 }
 return Object.freeze({schema:"sauceapproved.studio.system-registry-status/v1",ready:blocked.length===0,blockedSystemIds:Object.freeze(blocked),proofReceipts:Object.freeze(receipts),finalAuthority:"owner-controlled-release",failClosed:true});
}

export async function loadStudioSubsystemManifests(registry=createStudioSystemRegistry()){
 const loaded=[];
 for(const system of registry.systems){
  const factory=MANIFEST_FACTORIES[system.id];
  if(typeof factory!=="function") throw new Error("studio_subsystem_manifest_factory_missing:"+system.id);
  const manifest=await factory();
  if(!manifest||typeof manifest!=="object") throw new Error("studio_subsystem_manifest_invalid:"+system.id);
  loaded.push(Object.freeze({
   systemId:system.id,
   manifestExport:system.manifestExport,
   loaded:true,
   verified:false,
   currentEvidence:false,
   manifest
  }));
 }
 return Object.freeze(loaded);
}
