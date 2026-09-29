export function evaluateChargeBlock(x={}){
 const captureReady=x.pd==='TPS25751'&&x.charger==='BQ25792'&&x.seriesCells===4&&x.pdTargetW===45&&['i2cLinked','vbusProtected','ccProtected','packTelemetry','thermalAuthority','playbackChargeDerate'].every(k=>x[k]===true);
 return {captureReady,nominalPackV:14.4,maxPackChargeV:16.8,fabricationReady:false,purchaseAuthorized:false,productionReady:false};
}