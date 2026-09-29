export function evaluateTelemetryServiceBlock(x={}){
 const captureReady=x.boardTemp==='TMP117'&&x.batteryTempChannels>=2&&['packTelemetry','chargerFault','serviceDebug','debugControlled','signedFirmwareEnforced','keyedBatteryConnector','keyedSpeakerOutputs','channelLabels'].every(k=>x[k]===true)&&x.ampFaultChannels===4&&x.ampLimiterChannels===4;
 return {captureReady,productionDebugPolicy:'locked-or-authenticated',ercValidated:false,fabricationReady:false,purchaseAuthorized:false,productionReady:false};
}