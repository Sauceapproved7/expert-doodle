// SoundWorld V1 low-frequency protection screening.
// Simplified pre-EVT policy; nonlinear simulation and physical correlation remain mandatory.
const pos=(v,n)=>{if(!Number.isFinite(v)||v<=0)throw new RangeError(n+' must be positive');return v};
export function passiveRadiatorRisk({predictedMm,xmaxMm,safetyFraction=.85}){
 pos(predictedMm,'predictedMm');pos(xmaxMm,'xmaxMm');pos(safetyFraction,'safetyFraction');
 const allowedMm=xmaxMm*safetyFraction;
 return {predictedMm,allowedMm,headroomMm:allowedMm-predictedMm,pass:predictedMm<=allowedMm};
}
export function limiterCeiling({frequencyHz,tuningHz,baseVrms}){
 pos(frequencyHz,'frequencyHz');pos(tuningHz,'tuningHz');pos(baseVrms,'baseVrms');
 // Conservative sub-tuning voltage taper for screening. Final curve comes from nonlinear excursion data.
 const ratio=Math.min(1,frequencyHz/tuningHz);
 return baseVrms*Math.pow(ratio,2);
}
export function assessLowFrequencyProtection({driverPredictedMm,driverXmaxMm,prPredictedMm,prXmaxMm,frequencyHz,tuningHz,baseVrms}){
 const driver=passiveRadiatorRisk({predictedMm:driverPredictedMm,xmaxMm:driverXmaxMm});
 const radiator=passiveRadiatorRisk({predictedMm:prPredictedMm,xmaxMm:prXmaxMm});
 const ceilingVrms=limiterCeiling({frequencyHz,tuningHz,baseVrms});
 const reasons=[];
 if(!driver.pass)reasons.push('driver_excursion_margin_exceeded');
 if(!radiator.pass)reasons.push('passive_radiator_excursion_margin_exceeded');
 return {pass:reasons.length===0,reasons,ceilingVrms,driver,radiator,executionReady:false,claimReady:false};
}
