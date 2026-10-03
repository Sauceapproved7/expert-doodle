export function createDifferentiatorLayer(){
  const safeStates=[];
  return Object.freeze({
    intentLock({command,confidence=0,impact="normal"}={}){
      if(impact==="high" && confidence<0.85) return {decision:"confirm",reason:"high-impact-intent-below-threshold",command};
      return {decision:"allow",reason:"intent-confidence-satisfied",command};
    },
    capabilityPassport({target,owner="unknown",version="unknown"}={}){
      return Object.freeze({
        target,
        owner,
        version,
        authority:"owner-controlled",
        provenance:"tracked"
      });
    },
    recoveryTwin:Object.freeze({
      checkpoint(state={}) {
        safeStates.push(Object.freeze({...state}));
        if(safeStates.length>20) safeStates.shift();
        return {saved:true,depth:safeStates.length};
      },
      restoreSafe() {
        return safeStates[0] ? Object.freeze({...safeStates[0]}) : null;
      }
    })
  });
}
