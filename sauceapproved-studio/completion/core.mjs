const REQUIRED_SURFACES=Object.freeze([
  "reality-forge",
  "performance-lab",
  "scene-forge",
  "sound-world",
  "actor-lab",
  "studio-director",
  "integrations"
]);

export function createStudioCompletionManifest({commercial={}}={}){
  const paidCheckoutEnabled=commercial?.paidCheckoutEnabled===true;
  return Object.freeze({
    schema:"sauceapproved.studio.completion-manifest",
    version:1,
    product:"SauceApproved Studio",
    executionPolicy:"fail-closed",
    surfaces:Object.freeze([...REQUIRED_SURFACES]),
    surfacesReady:true,
    vintageCamera:Object.freeze({
      route:"/vintage-camera",
      deviceProofRequired:true,
      deviceProofVerified:false,
      fullQualityExportVerified:false,
      evidencePolicy:"physical-device-and-export-proof-required-before-quality-claim"
    }),
    commercial:Object.freeze({
      paidCheckoutEnabled,
      checkoutPolicy:String(commercial?.checkoutPolicy||"fail-closed"),
      checkoutLockedReason:String(commercial?.checkoutLockedReason||"studio_commercial_approval_and_payment_path_required")
    }),
    remainingOwnerOrPhysicalGates:Object.freeze([
      "vintage-camera-physical-device-proof",
      ...(paidCheckoutEnabled?[]:["studio-commercial-approval-and-payment-proof"])
    ]),
    completionRule:"Code-complete surfaces may be live while physical-device and commercial claims remain explicitly unverified."
  });
}
