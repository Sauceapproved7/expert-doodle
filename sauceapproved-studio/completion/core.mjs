const REQUIRED_SURFACES=Object.freeze(["reality-forge","performance-lab","scene-forge","sound-world","actor-lab","studio-director","integrations","creation-floor"]);
const DEPTH=Object.freeze([
 ["persistent-project-storage","persistentProjectStorage"],["real-media-ingest","realMediaIngest"],["interactive-timeline-persistence","interactiveTimelinePersistence"],["verified-renderer","verifiedRenderer"],["speech-to-text-runtime","speechToTextRuntime"],["audio-dsp-runtime","audioDspRuntime"],["private-review-sharing","privateReviewSharing"],["publishing-adapters","publishingAdapters"],["verified-performance-ingestion","verifiedPerformanceIngestion"],["verified-integration-ledger","verifiedIntegrationLedger"]
]);
export function createStudioCompletionManifest({commercial={},runtimeEvidence={}}={}){
 const paidCheckoutEnabled=commercial?.paidCheckoutEnabled===true;
 const verifiedCapabilities=DEPTH.filter(([,key])=>runtimeEvidence?.[key]===true).map(([id])=>id);
 const blockedCapabilities=DEPTH.filter(([,key])=>runtimeEvidence?.[key]!==true).map(([id])=>id);
 const deviceProofVerified=runtimeEvidence?.vintageCameraDeviceProof===true;
 const fullQualityExportVerified=runtimeEvidence?.vintageCameraFullQualityExport===true;
 const productionReady=blockedCapabilities.length===0&&deviceProofVerified&&fullQualityExportVerified;
 return Object.freeze({
  schema:"sauceapproved.studio.completion-manifest",version:2,product:"SauceApproved Studio",executionPolicy:"fail-closed",
  surfaces:Object.freeze([...REQUIRED_SURFACES]),surfacesReady:true,productionReady,
  creationFloor:Object.freeze({systems:Object.freeze(["project-hub","media-vault","timeline-editor","export-center","caption-transcript-lab","audio-workbench","project-time-machine","review-room","publishing-command-center","performance-feedback-loop"]),verifiedCapabilities:Object.freeze(verifiedCapabilities),blockedCapabilities:Object.freeze(blockedCapabilities)}),
  vintageCamera:Object.freeze({route:"/vintage-camera",deviceProofRequired:true,deviceProofVerified,fullQualityExportVerified,evidencePolicy:"physical-device-and-export-proof-required-before-quality-claim"}),
  commercial:Object.freeze({paidCheckoutEnabled,checkoutPolicy:String(commercial?.checkoutPolicy||"fail-closed"),checkoutLockedReason:String(commercial?.checkoutLockedReason||"studio_commercial_approval_and_payment_path_required")}),
  remainingOwnerOrPhysicalGates:Object.freeze([...(deviceProofVerified&&fullQualityExportVerified?[]:["vintage-camera-physical-device-proof"]),...(paidCheckoutEnabled?[]:["studio-commercial-approval-and-payment-proof"])]),
  completionRule:"A visible surface is not production-ready until its dependent runtime capability has current verification evidence."
 });
}
