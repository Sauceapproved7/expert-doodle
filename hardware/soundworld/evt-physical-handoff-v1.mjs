export function evaluateBuildHandoff(x={}){
 const required=['bomFrozen','assemblySequence','interconnectSpec','unitIdentityPlan','instrumentationReady','safetyReview'];
 const missing=required.filter(k=>x[k]!==true);
 return {authorized:missing.length===0,missing,scope:'evt-prototype-only',purchaseAuthorized:false,productionAuthorized:false,claimReady:false};
}