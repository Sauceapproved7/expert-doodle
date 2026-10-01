import {createStudioSystemRegistry,evaluateStudioSystemRegistry} from "../system-registry/core.mjs";

const validSha=value=>/^[a-f0-9]{64}$/i.test(String(value||""));
const realSources=new Set(["artifact","device","measurement","operator-attestation","runtime-receipt","delivery-receipt"]);

export function createReleaseTruthEvidenceStore({registry=createStudioSystemRegistry(),initialEvidence={}}={}){
 const evidence=Object.create(null);
 const known=new Set(registry.systems.map(system=>system.id));
 for(const [systemId,entry] of Object.entries(initialEvidence||{})){
  if(!known.has(systemId)) continue;
  if(entry?.verified!==true||entry?.current!==true||!validSha(entry?.artifactSha256)||!realSources.has(entry?.source)) continue;
  evidence[systemId]=Object.freeze({...entry,artifactSha256:String(entry.artifactSha256).toLowerCase()});
 }
 function record(entry={}){
  if(!known.has(entry.systemId)) throw new Error("unknown_studio_system");
  if(entry.source==="synthetic"||!realSources.has(entry.source)) throw new Error("real_evidence_required");
  if(entry.verified!==true||entry.current!==true||!validSha(entry.artifactSha256)) throw new Error("verified_current_sha256_evidence_required");
  evidence[entry.systemId]=Object.freeze({
   verified:true,
   current:true,
   artifactSha256:String(entry.artifactSha256).toLowerCase(),
   source:entry.source,
   recordedAt:entry.recordedAt||null
  });
  return evidence[entry.systemId];
 }
 function revoke(systemId){
  delete evidence[systemId];
  return status();
 }
 function status(){
  const evaluated=evaluateStudioSystemRegistry(registry,evidence);
  return Object.freeze({
   schema:"sauceapproved.studio.release-truth-evidence-status/v1",
   releaseReady:evaluated.ready,
   blockedSystemIds:evaluated.blockedSystemIds,
   proofReceipts:evaluated.proofReceipts,
   failClosed:true,
   syntheticEvidenceAllowed:false,
   finalAuthority:evaluated.finalAuthority
  });
 }
 return Object.freeze({record,revoke,status});
}
