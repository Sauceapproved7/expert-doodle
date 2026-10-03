export function qualifyRemainingEvtParts(x={}){
 const reasons=[];
 if(x.tweeter!=='ND20FA-6')reasons.push('tweeter_not_frozen');
 if(x.wireless!=='nRF5340')reasons.push('wireless_not_frozen');
 if(x.charger!=='BQ25792')reasons.push('charger_not_frozen');
 if(x.batteryManager!=='BQ40Z50')reasons.push('battery_manager_not_frozen');
 if(x.batteryNominalV!==14.4)reasons.push('battery_nominal_voltage_mismatch');
 if(!(Number.isFinite(x.batteryWh)&&x.batteryWh>=80&&x.batteryWh<=100))reasons.push('battery_energy_outside_architecture');
 if(x.batteryPackEvidence!==true)reasons.push('battery_pack_evidence_required');
 return {bomFrozen:reasons.length===0,reasons,purchaseAuthorized:false,productionAuthorized:false,claimReady:false};
}