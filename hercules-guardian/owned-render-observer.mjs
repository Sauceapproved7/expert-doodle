import {createHash} from "node:crypto";
function required(v,label){if(typeof v!=="string"||!v.trim())throw new Error(label+" is required");return v.trim()}
function sha(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex")}
export function createOwnedRenderObserver({service,deployment,policyId}={}){
 if(!service||typeof service!=="object")throw new Error("Render service evidence is required");
 if(!deployment||deployment.status!=="live"||!deployment.commit?.id)throw new Error("live deployment evidence is required");
 const id=required(service.id,"Render service id"),name=required(service.name,"Render service name"),policy=required(policyId,"Guardian policy id");
 const artifact="sha256:"+sha({commit:deployment.commit.id});
 const config="sha256:"+sha({branch:service.branch??null,runtime:service.serviceDetails?.runtime??null,url:service.serviceDetails?.url??null});
 const identity="render:"+id+":"+name;
 return Object.freeze(async()=>Object.freeze({artifact,config,identity,policy}));
}
