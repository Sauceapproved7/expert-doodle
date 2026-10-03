export function evaluatePeripheralFreeze(x={}){
 const reasons=[];
 if(x.audioClockMHz!==12.288)reasons.push('audio_clock_mismatch');
 if(x.i2sSampleRateKhz!==48)reasons.push('i2s_sample_rate_mismatch');
 if(x.usbEsd!=='TPD4E05U06')reasons.push('usb_esd_not_frozen');
 if(!(Number.isInteger(x.batteryTempSensors)&&x.batteryTempSensors>=2))reasons.push('dual_battery_temperature_sensing_required');
 for(const k of ['ampTempTelemetry','keyedBatteryConnector','serviceDebugControlled'])if(x[k]!==true)reasons.push(k+'_required');
 return {freezeReady:reasons.length===0,reasons,ercRequired:true,layoutReviewRequired:true,pcbFabAuthorized:false,productionReady:false};
}