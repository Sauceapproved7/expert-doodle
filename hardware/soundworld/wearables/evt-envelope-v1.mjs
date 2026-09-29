export function evaluateWearableEvtEnvelope(x={}){
 const envelopeFrozen=x.podsMassTargetG>0&&x.podsMassTargetG<=7&&x.maxMassTargetG>0&&x.maxMassTargetG<=320&&x.podsFeatureTests===true&&x.maxFeatureTests===true;
 const evidence=x.acousticMeasurements===true&&x.batteryMeasurements===true&&x.thermalMeasurements===true;
 return {envelopeFrozen,evtAccepted:envelopeFrozen&&evidence,productionReady:false,claimReady:false};
}