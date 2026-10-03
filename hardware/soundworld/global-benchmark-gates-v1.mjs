export function benchmarkReadiness(x={}){
 const reasons=[];
 if(!(Number.isFinite(x.runtimeHours)&&x.runtimeHours>=25))reasons.push('runtime_below_premium_field');
 if(!['IP67','IP68'].includes(x.ingress))reasons.push('ingress_not_premium_class');
 if(x.linkRoleRouting!==true)reasons.push('hercules_link_role_routing_unproven');
 if(!(Number.isFinite(x.linkMeasuredDriftMs)&&x.linkMeasuredDriftMs<=1))reasons.push('hercules_link_drift_unproven');
 if(x.replaceableBattery!==true)reasons.push('battery_serviceability_unproven');
 if(x.usbCPd!==true)reasons.push('usb_c_power_path_unproven');
 if(x.measuredAcoustics!==true)reasons.push('measured_acoustics_required');
 return {pass:reasons.length===0,reasons,productionReady:false,claimReady:false};
}