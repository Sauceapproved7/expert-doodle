export function evaluatePcbRelease(x={}){
 const required=['ercClean','powerGroundReview','typeCChecklist','rfReferenceLayout','audioTimingReview','thermalReview','connectorReview','bomTraceable'];
 const missing=required.filter(k=>x[k]!==true);
 return {evtPcbRelease:missing.length===0,missing,releaseClass:'EVT-PCB',fabricationQuoteAllowed:missing.length===0,purchaseAuthorized:false,productionAuthorized:false,claimReady:false};
}