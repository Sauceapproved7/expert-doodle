export function evaluateWearableDifferentiators(x={}){
 const podsReady=x.pods?.privateSceneMesh===true&&x.pods?.caseGuardian===true;
 const maxReady=x.max?.acousticTwin===true&&x.max?.creatorMonitor===true;
 return {podsReady,maxReady,architectureReady:podsReady&&maxReady&&x.baselineSeparated===true,exclusiveClaimAuthorized:false,productionReady:false};
}