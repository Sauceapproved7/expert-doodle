export function screenExcursionPoint({driverMm,radiatorMm,driverXmaxMm,radiatorXmaxMm,safetyFraction=.85}={}){
 const vals=[driverMm,radiatorMm,driverXmaxMm,radiatorXmaxMm,safetyFraction];
 if(vals.some(v=>!Number.isFinite(v)||v<=0))throw new Error('positive finite excursion inputs required');
 const driverLimit=driverXmaxMm*safetyFraction,radiatorLimit=radiatorXmaxMm*safetyFraction;
 const reasons=[];if(driverMm>driverLimit)reasons.push('driver_excursion_margin_exceeded');if(radiatorMm>radiatorLimit)reasons.push('radiator_excursion_margin_exceeded');
 return {pass:reasons.length===0,reasons,driverLimitMm:driverLimit,radiatorLimitMm:radiatorLimit,prototypeReady:false,claimReady:false};
}
export function deriveLimiterCurve({tuningHz,baseVrms,frequenciesHz}={}){
 if(!Number.isFinite(tuningHz)||tuningHz<=0||!Number.isFinite(baseVrms)||baseVrms<=0||!Array.isArray(frequenciesHz))throw new Error('valid limiter inputs required');
 return frequenciesHz.map(f=>{if(!Number.isFinite(f)||f<=0)throw new Error('positive frequency required');const ratio=Math.min(1,f/tuningHz);return {frequencyHz:f,maxVrms:baseVrms*ratio*ratio,provisional:true};});
}