export function evaluateIndustrialEnvelope(x={}){
 const reasons=[];
 for(const k of ['externalL','externalH','externalD'])if(!(Number.isFinite(x[k])&&x[k]>0))reasons.push(k+'_required');
 if(!(Number.isFinite(x.acousticNetL)&&x.acousticNetL>=5&&x.acousticNetL<=7.5))reasons.push('acoustic_net_volume_invalid');
 if(!Array.isArray(x.batteryEnvelope)||x.batteryEnvelope.length!==3||x.batteryEnvelope.some(v=>!Number.isFinite(v)||v<=0))reasons.push('battery_envelope_invalid');
 for(const k of ['opposedRadiators','stereoSymmetry','serviceAccess','rfKeepout','handleIndependent'])if(x[k]!==true)reasons.push(k+'_required');
 if(!(Number.isFinite(x.impactClearanceMm)&&x.impactClearanceMm>=5))reasons.push('impact_clearance_below_gate');
 return {cadFreezeReady:reasons.length===0,reasons,originalSystemEnvelope:true,prototypeOnly:true,productionReady:false,claimReady:false};
}