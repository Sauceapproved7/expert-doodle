const hard=['electricalHeadroom','thermalEvidence','lifecycleOk','firmwareSupport','compliancePath','interfaceCompatible'];
export function qualifyComponent(c={}){
 const reasons=[];
 if(!c.category)reasons.push('category_required');
 for(const k of hard)if(c[k]!==true)reasons.push(k+'_required');
 if(!['low','medium'].includes(c.sourcingRisk))reasons.push('sourcing_risk_unacceptable');
 if(!Number.isFinite(c.score)||c.score<0||c.score>100)reasons.push('score_invalid');
 return {qualified:reasons.length===0&&c.score>=75,reasons,score:Number.isFinite(c.score)?c.score:null,evtSampleRequired:true,productionReady:false,claimReady:false};
}
export const COMPONENT_CLASSES=Object.freeze(['mid-bass-driver','tweeter','passive-radiator','class-d-amplifier','audio-dsp','control-mcu','bluetooth-radio','usb-c-pd-charger','bms-fuel-gauge','battery-pack']);