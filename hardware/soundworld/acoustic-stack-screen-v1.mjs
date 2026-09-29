export function screenAcousticStack(x={}){
 const reasons=[];
 const a=x.active??{},r=x.radiator??{},e=x.enclosure??{},amp=x.amplifier??{};
 const activeVd=(a.count??0)*(a.vdCm3??0);
 const radiatorVd=(r.count??0)*(r.sdCm2??0)*(r.xmaxMm??0)/10;
 if(radiatorVd<2*activeVd)reasons.push('passive_radiator_displacement_below_2x');
 if(!(e.netLiters>=5&&e.netLiters<=7.5))reasons.push('net_volume_outside_evt_window');
 if(!(e.tuningHz>=48&&e.tuningHz<=58))reasons.push('tuning_outside_evt_window');
 if(!(amp.availableWPerMidbass>0&&amp.availableWPerMidbass<=a.rmsW))reasons.push('amplifier_power_outside_driver_screen');
 return {pass:reasons.length===0,reasons,activeVdCm3:activeVd,radiatorVdCm3:radiatorVd,displacementRatio:activeVd?radiatorVd/activeVd:0,prototypeReady:false,claimReady:false};
}