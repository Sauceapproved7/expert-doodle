export function evaluatePodsArchitecture(x={}){
 const required=['callMicPath','signedFirmware','soundDna','continuity','thermalTelemetry','hearingProtection','independentBudIdentity','ownedChargingCase','wearDetection'];
 const missing=required.filter(k=>x[k]!==true);if(!(x.ancMicPaths>=2))missing.push('hybrid_anc_mic_paths');
 return {architectureReady:missing.length===0,missing,evtReady:false,productionReady:false,claimReady:false};
}