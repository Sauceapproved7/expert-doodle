const OWNER="SauceApproved enterprise LLC";
export function createStudioOwnershipManifest(){
 return Object.freeze({
  schema:"sauceapproved.studio.ownership/v1",
  implementationOwner:OWNER,
  buildMode:"hercules-owned",
  scope:Object.freeze(["studio-surfaces","creation-floor-1-10","soundworld-1-12","studio-infrastructure-1-12"]),
  externalPlatforms:Object.freeze([]),
  thirdPartyHostedRuntimeAllowed:false,
  thirdPartyProductSubstitutionAllowed:false,
  interoperability:Object.freeze({
   allowed:true,
   outsideRuntimeControlAllowed:false,
   examples:Object.freeze(["usb-c","hdmi","3.5mm-audio","bluetooth","file-formats","operating-system-device-apis"])
  }),
  rules:Object.freeze([
   "owner-code-by-default",
   "no-finished-product-relabeling",
   "no-third-party-hosted-editor-or-runtime",
   "standards-are-interfaces-not-product-ownership",
   "physical-claims-require-physical-evidence",
   "proof-spine-preserved"
  ])
 });
}
