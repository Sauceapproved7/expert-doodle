const SYSTEMS=Object.freeze([
["project-hub","Hercules Project Hub","Project identity, lifecycle and cross-Studio routing"],
["media-vault","Universal Media Vault","Assets, provenance, rights and searchable metadata"],
["timeline-editor","Hercules Timeline Editor","Non-destructive multitrack composition"],
["export-center","Hercules Export Center","Delivery presets, quality gates and proof receipts"],
["caption-transcript-lab","Caption & Transcript Lab","Transcripts, subtitles, translation and caption styling"],
["audio-workbench","Hercules Audio Workbench","Dialogue, music, foley, cleanup and mix planning"],
["project-time-machine","Project Time Machine","Snapshots, comparison and safe restoration"],
["review-room","Hercules Review Room","Timestamped review, approvals and sign-off"],
["publishing-command-center","Publishing Command Center","Authorized previews, scheduling and final approval"],
["performance-feedback-loop","Performance Feedback Loop","Evidence feedback without silent Brand Brain mutation"]
].map(([id,label,purpose])=>Object.freeze({id,label,purpose,status:"foundation-ready",herculesOwned:true,outsidePlatformAllowed:false})));

export function createCreationFloorManifest(){
 return Object.freeze({
  id:"hercules-creation-floor",version:"0.2.0",mode:"inventory-plan-authorize-fail-closed",
  implementationOwner:"SauceApproved enterprise LLC",buildMode:"hercules-owned",
  externalPlatforms:Object.freeze([]),thirdPartyHostedRuntimeAllowed:false,thirdPartyProductSubstitutionAllowed:false,
  standardsPolicy:"interoperate-with-open-or-device-standards-without-outsourcing-the-product",
  systems:SYSTEMS,
  differentiators:[
   "Proof Spine: every asset, edit, review, export and publish handoff can carry provenance evidence",
   "Creative DNA Guard: performance feedback may recommend changes but cannot silently mutate Brand Brain"
  ],
  execution:{autonomousPublishing:false,credentialCollectionAllowed:false,unverifiedRenderClaims:false}
 });
}

export function buildCreationFloorProject({title,ownerId}={}){
 if(!String(title||"").trim()||!String(ownerId||"").trim()) throw new Error("creation_floor_project_identity_required");
 return {
  schema:"hercules.creation-floor.project/v1",id:"pending-persistence",title:String(title).trim(),ownerId:String(ownerId).trim(),
  version:1,assets:[],timeline:{tracks:[],durationMs:0},reviews:[],snapshots:[],
  controls:{
   export:{enabled:false,reason:"render_provider_and_export_proof_required"},
   publish:{enabled:false,reason:"authorized_destination_and_final_approval_required"},
   analytics:{enabled:false,reason:"verified_performance_source_required"}
  }
 };
}
