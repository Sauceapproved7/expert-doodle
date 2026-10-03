export function protectionAuthority(){return ['hardware-protection','firmware-safety','scene-mode','hercules-link'];}
const req=(c,r,n)=>{if(!c)r.push(n)};
export function validateDvtInterface(x={}){
 const reasons=[];
 req(x.batteryBus?.nominalV===14.4,reasons,'battery_bus_contract');
 req(x.usbPd?.maxInputW===45,reasons,'usb_pd_contract');
 req(x.amplifier?.channels===4,reasons,'four_channel_amplifier');
 req(x.dsp?.sceneMode===true,reasons,'scene_mode_required');
 req(x.dsp?.immutableProtection===true,reasons,'immutable_protection_required');
 req(x.mcu?.signedFirmware===true&&x.mcu?.rollback===true,reasons,'secure_rollback_firmware');
 for(const k of ['battery-temp','amplifier-temp','limiter'])req(x.telemetry?.includes(k),reasons,'telemetry_'+k);
 const roles=['front','fill','dialogue-focus','bass-support'];
 req(roles.every(r=>x.link?.roles?.includes(r)),reasons,'hercules_link_roles');
 req(Number.isFinite(x.link?.maxDriftMs)&&x.link.maxDriftMs<=1,reasons,'hercules_link_drift');
 return {pass:reasons.length===0,reasons,productionReady:false,claimReady:false};
}
export const DVT_INTERFACE=Object.freeze({
 batteryBus:{nominalV:14.4},
 usbPd:{maxInputW:45},
 amplifier:{channels:4},
 dsp:{sceneMode:true,immutableProtection:true},
 mcu:{signedFirmware:true,rollback:true},
 telemetry:['battery-temp','amplifier-temp','limiter'],
 link:{roles:['front','fill','dialogue-focus','bass-support'],maxDriftMs:1}
});