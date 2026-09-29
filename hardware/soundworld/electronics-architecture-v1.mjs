export function evaluateElectronicsArchitecture(x={}){
 const reasons=[];
 if(x.batteryBusV!==14.4)reasons.push('battery_bus_mismatch');
 if(x.ampChannels!==4)reasons.push('four_amp_channels_required');
 for(const k of ['dedicatedDsp','wirelessControl','usbCPd','bmsTelemetry','dualTemp','hardwareProtectionHighest','signedFirmware','serviceDebugLocked'])if(x[k]!==true)reasons.push(k+'_required');
 return {schematicReady:reasons.length===0,reasons,ownedBoardArchitecture:true,schematicReviewRequired:true,layoutReviewRequired:true,pcbProductionAuthorized:false,productionReady:false};
}