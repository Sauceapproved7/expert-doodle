export function evaluateChassisCad(x={}){
 const reasons=[];
 if(!(Number.isFinite(x.shellWallMm)&&x.shellWallMm>=2.5))reasons.push('shell_wall_study_below_gate');
 if(!(Number.isFinite(x.baffleWallMm)&&x.baffleWallMm>=3.5))reasons.push('baffle_wall_study_below_gate');
 if(!(Number.isInteger(x.braceCount)&&x.braceCount>=2))reasons.push('insufficient_bracing');
 if(!(Number.isInteger(x.fastenerZones)&&x.fastenerZones>=6))reasons.push('insufficient_fastener_zones');
 if(!(Number.isInteger(x.gasketInterfaces)&&x.gasketInterfaces>=3))reasons.push('gasket_interfaces_missing');
 for(const k of ['servicePanelIndependentSeal','batteryStructuralRetention','radiatorSweepClear','rfKeepoutClear'])if(x[k]!==true)reasons.push(k+'_required');
 return {cadReady:reasons.length===0,reasons,evtStudy:true,feaRequired:true,dropValidationRequired:true,acousticCorrelationRequired:true,productionReady:false};
}