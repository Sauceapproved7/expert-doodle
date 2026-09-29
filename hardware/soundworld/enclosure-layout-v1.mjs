const need=(c,r,n)=>{if(!c)r.push(n)};
export function assessEnclosureLayout(x={}){
 const reasons=[];
 need(Number.isFinite(x.grossLiters)&&x.grossLiters>=6&&x.grossLiters<=8.5,reasons,'gross_volume_outside_study_envelope');
 need(x.opposedRadiators===true,reasons,'opposed_radiators_required');
 need(x.stereoSymmetry===true,reasons,'stereo_symmetry_required');
 need(x.batteryIsolated===true,reasons,'battery_mechanical_isolation_required');
 need(x.pcbIsolated===true,reasons,'pcb_mechanical_isolation_required');
 need(Number.isFinite(x.antennaKeepoutMm)&&x.antennaKeepoutMm>=10,reasons,'rf_keepout_insufficient');
 need(x.gasketZones===true,reasons,'gasket_zones_required');
 need(['battery','usb-c'].every(v=>x.serviceAccess?.includes(v)),reasons,'service_access_incomplete');
 need(Number.isFinite(x.impactClearanceMm)&&x.impactClearanceMm>=5,reasons,'impact_clearance_insufficient');
 return {pass:reasons.length===0,reasons,cadFreezeReady:false,productionReady:false,claimReady:false};
}
export const ENCLOSURE_DVT_ENVELOPE=Object.freeze({grossLiters:[6,8.5],antennaKeepoutMm:10,impactClearanceMm:5,requiredServiceAccess:['battery','usb-c']});