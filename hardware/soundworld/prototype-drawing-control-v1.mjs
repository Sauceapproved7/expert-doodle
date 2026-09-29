export function releasePrototypeDrawingPack(x={}){
 const required=['drawingIndex','criticalDimensions','tolerances','materials','fastenerSchedule','gasketSchedule','bomRefs','revisionBlock','deviationProcess','inspectionPlan'];
 const missing=required.filter(k=>x[k]!==true);
 return {released:missing.length===0,missing,releaseClass:'EVT-PROTOTYPE',toolingAuthorized:false,productionAuthorized:false,claimReady:false};
}