export function evaluateEdaRelease(x={}){
 const edaSourceReady=['schematicFile','pcbFile','projectFile'].every(k=>x[k]===true);
 const evidence=['ercClean','drcClean','powerReview','rfReview','thermalReview','bomExact','gerbersGenerated','drillsGenerated','placementGenerated'];
 const missing=evidence.filter(k=>x[k]!==true);
 return {edaSourceReady,fabricationPackageReady:edaSourceReady&&missing.length===0,missing,purchaseAuthorized:false,productionReady:false,claimReady:false};
}