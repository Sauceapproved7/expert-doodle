import {createOwnedRenderObserver} from "./owned-render-observer.mjs";
import {createCanonicalBrowserRuntimeObserver} from "./canonical-browser-runtime.mjs";

async function entry(id,scope,observer){
 const baseline=await observer();
 return Object.freeze({id,scope,baseline,observe:observer,executionAuthority:false});
}
export function createLiveDeploymentRegistry({forge,runtime}={}){
 const forgeObserver=createOwnedRenderObserver({...forge,policyId:"guardian-forge-v1"});
 if(forge?.service?.id!=="srv-dat58e7lk1mc73eaq310"||forge?.service?.name!=="sauceapproved-forge-control"||forge?.service?.repo!=="https://github.com/Sauceapproved7/expert-doodle")throw new Error("canonical owned Forge control required");
 const runtimeObserver=createCanonicalBrowserRuntimeObserver(runtime);
 return [
  Object.freeze({id:"forge",scope:"service",baseline:null,observe:forgeObserver,executionAuthority:false}),
  Object.freeze({id:"runtime",scope:"control-plane",baseline:null,observe:runtimeObserver,executionAuthority:false})
 ];
}
export async function materializeLiveDeploymentRegistry(input){
 const raw=createLiveDeploymentRegistry(input);
 return Object.freeze(await Promise.all(raw.map(async x=>entry(x.id,x.scope,x.observe))));
}
