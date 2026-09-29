export function evaluatePowerTree(x={}){
 const reasons=[];
 if(x.packNominalV!==14.4)reasons.push('pack_bus_mismatch');
 if(x.primaryBuck!=='TPS62933'||x.primaryMaxA!==3)reasons.push('primary_buck_mismatch');
 if(x.rfBuck!=='TPS62840')reasons.push('rf_buck_mismatch');
 if(x.rfInputFromLowVoltageRail!==true)reasons.push('rf_buck_cannot_connect_directly_to_4s_bus');
 for(const k of ['railBudgetEvidence','thermalBudgetEvidence'])if(x[k]!==true)reasons.push(k+'_required');
 return {freezeReady:reasons.length===0,reasons,pcbFabAuthorized:false,productionReady:false};
}