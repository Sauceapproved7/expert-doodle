export function evaluateSoundWorldPack(x={}){
 const reasons=[];
 if(x.seriesCells!==4||x.nominalV!==14.4)reasons.push('4s_14v4_architecture_required');
 if(!(Number.isFinite(x.energyWh)&&x.energyWh>=80&&x.energyWh<=100))reasons.push('energy_outside_target');
 for(const k of ['cellTraceability','dualTemperatureSensing','cellBalancing','overVoltageProtection','underVoltageProtection','overCurrentProtection','shortCircuitProtection','serviceDisconnect','transportEvidence'])if(x[k]!==true)reasons.push(k+'_required');
 if(x.packManager!=='BQ40Z50')reasons.push('pack_manager_mismatch');
 return {evtReady:reasons.length===0,reasons,ownedSystemDesign:true,productionReady:false,claimReady:false};
}