const check=(o,keys)=>keys.filter(k=>o?.[k]!==true);
export function authorizeEvt(o={}){
 const missing=check(o,['architectureFrozen','componentShortlist','enclosureConstraints','powerSafety','excursionProtection','testPlan','instrumentation']);
 return {authorized:missing.length===0,missing,scope:'engineering-prototype-only',productionReady:false,claimReady:false};
}
export function authorizeDvt(o={}){
 const reasons=[];if(o.evtAuthorized!==true)reasons.push('evt_not_authorized');if(o.measuredEvidence!==true)reasons.push('measured_evt_evidence_required');if(o.repeatablePass!==true)reasons.push('repeatable_pass_required');if(!Number.isInteger(o.openSafetyFailures)||o.openSafetyFailures!==0)reasons.push('open_safety_failures_must_be_zero');
 return {authorized:reasons.length===0,reasons,productionReady:false,claimReady:false};
}