import {createOwnedRenderObserver} from "./owned-render-observer.mjs";
const ID="srv-daskfp8u01pc73cbvj0g";
const NAME="hercules-browser-standalone";
const REPO="https://github.com/Sauceapproved7/expert-doodle";
export function createCanonicalBrowserRuntimeObserver({service,deployment}={}){
 if(!service||service.id!==ID||service.name!==NAME||service.repo!==REPO) throw new Error("canonical owned browser runtime required");
 return createOwnedRenderObserver({service,deployment,policyId:"guardian-browser-runtime-v1"});
}
