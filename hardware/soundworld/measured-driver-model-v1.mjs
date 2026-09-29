// SoundWorld measured-driver screening model. No customer-facing claims.
const req=['fsHz','qts','vasLiters','reOhms','leMilliHenry','sdCm2','xmaxMm'];
export function validateMeasuredTs(ts){
 if(!ts||req.some(k=>!Number.isFinite(ts[k])||ts[k]<=0)) throw new TypeError('complete positive measured T/S parameters required: '+req.join(', '));
 return {...ts};
}
export function closedBoxEstimate(ts,netLiters){
 validateMeasuredTs(ts); if(!Number.isFinite(netLiters)||netLiters<=0)throw new RangeError('netLiters must be positive');
 const alpha=ts.vasLiters/netLiters;
 return {qtc:ts.qts*Math.sqrt(1+alpha),fcHz:ts.fsHz*Math.sqrt(1+alpha),model:'linear-small-signal-screening',claimReady:false};
}
export function excursionRiskEnvelope({sdCm2,xmaxMm,requiredVolumeLiters,count=1}){
 if([sdCm2,xmaxMm,requiredVolumeLiters,count].some(v=>!Number.isFinite(v)||v<=0))throw new RangeError('positive excursion inputs required');
 const requiredMm=(requiredVolumeLiters*1000/sdCm2/count)*10;
 return {requiredMm,xmaxMm,headroomRatio:xmaxMm/requiredMm,pass:requiredMm<=xmaxMm,claimReady:false};
}
export function impedanceEstimate(ts,frequencyHz){
 validateMeasuredTs(ts); if(!Number.isFinite(frequencyHz)||frequencyHz<=0)throw new RangeError('frequencyHz must be positive');
 const xl=2*Math.PI*frequencyHz*(ts.leMilliHenry/1000);
 return Math.hypot(ts.reOhms,xl);
}
export function measuredDriverScreen({ts,netLiters,requiredVolumeLiters,count=2}){
 validateMeasuredTs(ts);
 const response=closedBoxEstimate(ts,netLiters);
 const excursion=excursionRiskEnvelope({sdCm2:ts.sdCm2,xmaxMm:ts.xmaxMm,requiredVolumeLiters,count});
 return {response,excursion,measuredInputsRequired:true,simulationReady:true,prototypeReady:excursion.pass,claimReady:false};
}
