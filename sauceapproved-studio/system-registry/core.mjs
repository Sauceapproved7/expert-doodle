const OWNER="SauceApproved enterprise LLC";
const sha=v=>/^[a-f0-9]{64}$/i.test(String(v||""));
const system=(id,label,source,kind)=>Object.freeze({id,label,source,kind,implementationOwner:OWNER,herculesOwned:true,externalRuntimeRequired:false});
export function createStudioSystemRegistry(){
 return Object.freeze({
  schema:"sauceapproved.studio.system-registry/v1",
  implementationOwner:OWNER,
  buildMode:"hercules-owned",
  externalPlatforms:Object.freeze([]),
  executionPolicy:"inventory-evidence-evaluate-authorize-release",
  systems:Object.freeze([
   system("creation-floor","Creation Floor","sauceapproved-studio/creation-floor/core.mjs","software"),
   system("creation-floor-production-ops","Creation Floor Production Ops","sauceapproved-studio/creation-floor/production-ops.mjs","software"),
   system("soundworld","SoundWorld Product Family","soundworld/product-family.mjs","software-hardware-contract"),
   system("soundworld-field-system","SoundWorld Field System","soundworld/field-system.mjs","software-hardware-contract"),
   system("studio-infrastructure","Studio Infrastructure","sauceapproved-studio/infrastructure/core.mjs","software-hardware-contract"),
   system("studio-infrastructure-production","Studio Infrastructure Production Systems","sauceapproved-studio/infrastructure/production-systems.mjs","software-hardware-contract"),
   system("studio-memory-grid","Studio Memory Grid","sauceapproved-studio/memory-grid/core.mjs","software"),
   system("studio-global-closure","Studio Global Closure + Release Truth Room","sauceapproved-studio/global-closure/core.mjs","software"),
   system("hardware-engineering-program","Studio Hardware Engineering Program","hardware/studio-gap-closure/program.mjs","physical-engineering-contract")
  ]),
  releasePolicy:Object.freeze({failClosed:true,physicalClaimsRequirePhysicalEvidence:true,ownerApprovalRequired:true})
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
