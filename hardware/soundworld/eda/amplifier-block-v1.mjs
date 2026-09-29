export function evaluateAmplifierBlock(x={}){
 const captureReady=x.devices===2&&x.part==='TAS5825M'&&x.channels===4&&x.pvddNominalV===14.4&&x.digitalAudio===true&&['hardwareFaultAuthority','thermalProtection','excursionProtection','sceneCannotOverrideProtection','linkCannotOverrideProtection'].every(k=>x[k]===true);
 return {captureReady,outputNetworkFrozen:captureReady&&x.outputFilterEvidence===true,ercValidated:false,drcValidated:false,fabricationReady:false,purchaseAuthorized:false,productionReady:false,claimReady:false};
}