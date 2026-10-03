// Hercules SoundWorld EVT-A acoustic feasibility model.
// Engineering model only. Results are not product claims.
const finite=(n,name)=>{if(!Number.isFinite(n))throw new TypeError(name+' must be finite');return n};
export function driverDisplacementLiters({sdCm2,xmaxMm,count=2}){
  finite(sdCm2,'sdCm2');finite(xmaxMm,'xmaxMm');finite(count,'count');
  if(sdCm2<=0||xmaxMm<=0||count<=0)throw new RangeError('driver inputs must be positive');
  return sdCm2*(xmaxMm/10)*count/1000;
}
export function requiredPassiveRadiatorDisplacementLiters(driverVdLiters,margin=2){
  finite(driverVdLiters,'driverVdLiters');finite(margin,'margin');
  if(driverVdLiters<=0||margin<1)throw new RangeError('invalid displacement or margin');
  return driverVdLiters*margin;
}
export function netVolumeLiters({grossLiters,drivers=0,radiators=0,battery=0,electronics=0,bracing=0}){
  const values=[grossLiters,drivers,radiators,battery,electronics,bracing];
  if(values.some(v=>!Number.isFinite(v)||v<0))throw new RangeError('volume inputs must be finite and nonnegative');
  const net=grossLiters-drivers-radiators-battery-electronics-bracing;
  if(net<=0)throw new RangeError('displacements consume enclosure');
  return net;
}
export function assessEvta({netLiters,tuningHz,driverVdLiters,passiveRadiatorVdLiters}){
  const reasons=[];
  if(netLiters<5||netLiters>7.5) reasons.push('net_volume_outside_evta_window');
  if(tuningHz<48||tuningHz>58) reasons.push('tuning_outside_study_window');
  if(passiveRadiatorVdLiters < driverVdLiters*2) reasons.push('passive_radiator_displacement_margin_low');
  return {pass:reasons.length===0,reasons,executionReady:false,claimReady:false};
}
