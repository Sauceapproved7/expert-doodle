const sensitiveKey=/(token|password|secret|api.?key|authorization|credential|service.?role|private.?key)/i;
const credentialValue=/(\bbearer\s+\S+|\bgh[pousr]_[A-Za-z0-9_]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
function clean(value){
 const seen=new Set();
 function visit(v){
  if(typeof v==="string"){if(credentialValue.test(v))throw new Error("credential-shaped value rejected");return;}
  if(v===null||typeof v!=="object")return;
  if(seen.has(v))throw new Error("cyclic input rejected");
  seen.add(v);
  if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)throw new Error("unsupported input object");
  for(const [key,item] of Object.entries(v)){if(sensitiveKey.test(key))throw new Error("credential field rejected");visit(item);}
  seen.delete(v);
 }
 visit(value);
 return structuredClone(value);
}
function need(fn,name){if(typeof fn!=="function")throw new Error(name+" adapter unavailable");return fn}
function exactTrue(fn,arg){try{return typeof fn==="function"&&fn(arg)===true}catch{return false}}
function authorized(d,service,input,containment=false){
 try{
  const trust=d.assessTrust?.();
  if(trust?.identityTrusted!==true||trust?.auditTrusted!==true)return false;
  if(containment){
   if(!exactTrue(d.authorizeContainment,{service,action:input.action,reason:input.reason}))return false;
  }else{
   if(!exactTrue(d.emergencyStopClear))return false;
   if(!exactTrue(d.authorizeOperation,{service,action:input.action,input}))return false;
  }
  return true;
 }catch{return false}
}
export function createHerculesAbyssAdapters(d={}){
 async function invoke(service,input,{containment=false}={}){
  const x=clean(input);
  if(!authorized(d,service,x,containment))throw new Error("external identity, emergency-stop, and authorization checks required");
  return need(d[service],service)(x);
 }
 return Object.freeze({
  async browser(input){const x=clean(input);if(!["navigate","scrape","screenshot","interact","close_session"].includes(x?.action))throw new Error("browser action denied");return invoke("browser",x)},
  async vault(input){const x=clean(input);if(x?.action!=="search")throw new Error("vault action denied");return invoke("vault",x)},
  async forge(input){const x=clean(input);if(x?.action!=="build"||x.preview!==true)throw new Error("preview required");return invoke("forge",x)},
  async deploy(input){const x=clean(input);if(x?.action!=="status")throw new Error("deploy mutation denied");return invoke("deploy",x)},
  async contain(input){const x=clean(input);if(!["revoke-identities","kill-sessions","quarantine-workers","freeze-deployments","preserve-evidence"].includes(x?.action))throw new Error("containment action denied");return invoke("containment",x,{containment:true})},
  async recover(input){const x=clean(input);if(!x||typeof x!=="object"||!exactTrue(d.verifyRecoveryArtifact,x.artifact))throw new Error("externally verified signed known-good artifact required");if(!authorized(d,"recovery",x))throw new Error("external identity, emergency-stop, and authorization checks required");return need(d.recovery,"recovery")(x)}
 });
}
