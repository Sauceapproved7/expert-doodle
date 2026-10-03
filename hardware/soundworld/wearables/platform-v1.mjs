export function evaluateWearablePlatform(x={}){
 const required=['pods','overEar','anc','transparency','spatial','multipoint','soundDna','continuity','hearingProtection','signedFirmware','localProfile'];
 const missing=required.filter(k=>x[k]!==true);
 return {architectureReady:missing.length===0,missing,ownedPlatform:true,prototypeReady:false,productionReady:false,claimReady:false};
}