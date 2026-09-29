export function evaluateWearableComponents(x={}){
 const siliconFrozen=x.audioPlatform==='QCC7226'&&x.hybridAnc===true&&x.leAudio===true&&x.signedFirmware===true;
 const evidence=['driverMeasured','micsMeasured','batteryQualified','chargeQualified'];
 const missing=evidence.filter(k=>x[k]!==true);
 return {siliconFrozen,evtBuildReady:siliconFrozen&&missing.length===0,missingEvidence:missing,productionReady:false,superiorityClaimReady:false};
}