export function evaluateSchematicFreeze(x={}){
 const reasons=[];
 if(x.charger!=='BQ25792')reasons.push('charger_mismatch');
 if(x.wireless!=='nRF5340')reasons.push('wireless_mismatch');
 if(x.audioBus!=='I2S')reasons.push('audio_bus_mismatch');
 if(x.ampChannels!==4)reasons.push('four_amp_channels_required');
 if(x.batterySeries!==4)reasons.push('4s_pack_required');
 for(const k of ['hardwareProtection','esdPlan','groundingPlan','thermalTelemetry','pdControllerSelected'])if(x[k]!==true)reasons.push(k+'_required');
 return {frozen:reasons.length===0,reasons,schematicReviewRequired:true,pcbFabAuthorized:false,productionReady:false};
}