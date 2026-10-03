export function evaluateWearableRfq(x={}){
 const quoteReady=Number.isInteger(x.podsUnits)&&x.podsUnits>=3&&Number.isInteger(x.maxUnits)&&x.maxUnits>=3&&['exactMpns','authorizedSources','traceability','noSilentSubstitutions','complianceDocs'].every(k=>x[k]===true);
 return {quoteReady,podsUnits:x.podsUnits,maxUnits:x.maxUnits,purchaseAuthorized:x.ownerPurchaseApproval===true&&quoteReady,productionReady:false,claimReady:false};
}