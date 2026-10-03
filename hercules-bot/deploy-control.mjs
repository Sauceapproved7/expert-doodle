const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function id(value,label){
 const v=String(value??"").trim();
 if(!ID.test(v)) throw new Error("invalid "+label);
 return v;
}
function cleanRelease(input={}){
 const target=input.target;
 if(!target || typeof target!=="object") throw new Error("target required");
 return {
  releaseId:id(input.releaseId,"release id"),
  sourceCommit:id(input.sourceCommit,"source commit"),
  artifactFingerprint:id(input.artifactFingerprint,"artifact fingerprint"),
  target:{kind:id(target.kind,"target kind"),reference:id(target.reference,"target reference")},
  ...(input.publicOrigin?{publicOrigin:new URL(String(input.publicOrigin)).toString()}:{}),
 };
}

export function createDeployControl({request}={}){
 if(typeof request!=="function") throw new TypeError("server-side deploy request function required");
 return Object.freeze({
  release:input=>request({method:"POST",path:"/v1/deployments",body:cleanRelease(input)}),
  status:deploymentId=>request({method:"GET",path:"/v1/deployments/"+encodeURIComponent(id(deploymentId,"deployment id"))}),
  rollback:deploymentId=>request({method:"POST",path:"/v1/deployments/"+encodeURIComponent(id(deploymentId,"deployment id"))+"/rollback",body:{}}),
 });
}
