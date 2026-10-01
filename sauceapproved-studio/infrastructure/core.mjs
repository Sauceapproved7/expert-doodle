const OWNER="SauceApproved enterprise LLC";
const layer=(id,label,kind,requirements)=>Object.freeze({
 id,label,kind,
 requirements:Object.freeze(requirements),
 implementationOwner:OWNER,
 herculesOwned:true,
 outsidePlatformAllowed:false,
 verified:false,
 evidence:null
});
export function createStudioInfrastructureManifest(){
 const layers=[
  layer("equipment-kit","Studio Equipment Kit","physical",["owned-cable-specs","usb-c-data-cables","usb-c-charging-cables","3.5mm-audio-cables","owned-powered-hub-design","owned-adapter-specs","cable-management","spares-inventory"]),
  layer("power-station","Studio Power Station","physical",["owned-power-architecture","surge-protection","charging-dock","ups-option","power-budget","safe-shutdown-plan","electrical-safety-validation"]),
  layer("camera-io","Camera I/O Kit","hybrid",["owned-capture-interface","usb-camera-input","hdmi-capture","external-monitor-output","device-enumeration","capture-health-proof"]),
  layer("teleprompter","Hercules Teleprompter","software",["owned-script-engine","script-import","speed-control","mirrored-mode","remote-control-contract","director-integration"]),
  layer("lighting-control","Lighting Control","hybrid",["owned-lighting-control-layer","key-fill-back-presets","scene-profiles","manual-fallback","device-protocol-bridge","device-proof"]),
  layer("color-suite","Color Suite","software",["owned-color-engine","waveform-scope","vectorscope","white-balance","exposure-controls","lut-management","shot-match","before-after"]),
  layer("monitor-mode","Studio Monitor Mode","software",["owned-monitor-engine","clean-output","second-screen-preview","safe-area-guides","aspect-ratio-guides","client-preview"]),
  layer("camera-mic-sync","Camera + Mic Sync","software",["owned-sync-engine","waveform-sync","manual-sync-marker","drift-detection","alignment-plan","multicamera-ready"]),
  layer("hardware-control-surface","Hardware Control Surface","hybrid",["owned-soundworld-hub","volume","mute","monitoring","record-control","studio-bridge-runtime-proof"]),
  layer("accessibility-suite","Accessibility Suite","software",["owned-accessibility-layer","keyboard-operation","screen-reader-labels","high-contrast","reduced-motion","caption-first-workflow"]),
  layer("portable-project-package","Portable Project Package","software",["owned-project-format","project-manifest","media-reference-map","timeline-and-captions","audio-profile","proof-spine","checksums","restore-validation"]),
  layer("creation-floor-runtime","Creation Floor Runtime","runtime",["owned-runtime","persistent-project-storage","real-media-ingest","interactive-timeline-persistence","verified-renderer","speech-to-text-runtime","audio-dsp-runtime","private-review-sharing","publishing-adapters","verified-performance-ingestion","verified-integration-ledger"])
 ];
 return Object.freeze({
  schema:"sauceapproved.studio.infrastructure/v2",
  implementationOwner:OWNER,
  buildMode:"hercules-owned",
  externalPlatforms:Object.freeze([]),
  thirdPartyHostedRuntimeAllowed:false,
  thirdPartyProductSubstitutionAllowed:false,
  standardsPolicy:"interoperate-with-open-or-device-standards-without-outsourcing-the-product",
  executionPolicy:"inventory-plan-authorize-execute-verify",
  layers:Object.freeze(layers),
  rules:Object.freeze([
   "hercules-owned-implementation",
   "no-outside-platform-substitution",
   "no-third-party-hosted-runtime",
   "no-physical-proof-without-device-evidence",
   "no-provider-connection-without-runtime-evidence",
   "no-autonomous-publishing",
   "proof-spine-preserved"
  ])
 });
}
export function evaluateStudioInfrastructure(manifest,evidence={}){
 const verified=[],blocked=[];
 for(const item of manifest.layers){
  if(evidence[item.id]?.verified===true)verified.push(item.id); else blocked.push(item.id);
 }
 return Object.freeze({productionReady:blocked.length===0,verified:Object.freeze(verified),blocked:Object.freeze(blocked)});
}
