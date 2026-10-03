// Hercules SoundWorld V1 charger/power policy model. Hardware thresholds require EVT validation.
export function choosePdProfile(sourceWatts,hardwareMaxWatts=45){
 if(!Array.isArray(sourceWatts)||!Number.isFinite(hardwareMaxWatts)||hardwareMaxWatts<=0)return null;
 const ok=sourceWatts.filter(w=>Number.isFinite(w)&&w>=15&&w<=hardwareMaxWatts).sort((a,b)=>b-a);
 return ok[0]??null;
}
export function assessChargeState({batteryTempC,packVoltageV,packCurrentA,playingWatts=0}){
 if([batteryTempC,packVoltageV,packCurrentA,playingWatts].some(v=>!Number.isFinite(v)))throw new TypeError('finite power telemetry required');
 const chargeAllowed=batteryTempC>=5&&batteryTempC<=45;
 if(!chargeAllowed)return {chargeAllowed:false,mode:'thermal-charge-lockout',outputDerate:true,claimReady:false};
 if(playingWatts>=30)return {chargeAllowed:true,mode:'playback-priority-derated-charge',outputDerate:false,claimReady:false};
 return {chargeAllowed:true,mode:'normal-charge',outputDerate:false,claimReady:false};
}
export const POWER_SAFETY_POLICY=Object.freeze({
 usbCPdTargetWatts:45,
 protections:['over-voltage','under-voltage','over-current','short-circuit','battery-over-temperature','battery-under-temperature','charger-over-temperature'],
 firmwareRules:['protection-limits-not-user-disableable','failed-update-rolls-back','unsafe-telemetry-fails-closed'],
 validation:['charge-time','charge-while-playing','connector-temperature','battery-temperature','fault-cutoff','cycle-aging','brownout-recovery']
});
