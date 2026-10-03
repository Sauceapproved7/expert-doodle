export function evaluatePdSelection(x={}){
 const reasons=[];
 if(x.controller!=='TPS25751')reasons.push('pd_controller_not_tps25751');
 if(x.charger!=='BQ25792')reasons.push('charger_not_bq25792');
 for(const k of ['integratedChargerControl','pdCertified','drpCapable','protectedPowerPath','evtConfigValidated'])if(x[k]!==true)reasons.push(k+'_required');
 return {selected:x.controller==='TPS25751',fullSchematicFrozen:reasons.length===0,reasons,pcbFabAuthorized:false,productionReady:false};
}