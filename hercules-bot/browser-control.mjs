const ACTIONS=new Set(["navigate","scrape","screenshot","interact","close_session"]);
const STEPS=new Set(["click","type","wait","extract"]);

function validateUrl(value){
 const u=new URL(String(value));
 if(!["http:","https:"].includes(u.protocol)) throw new Error("target must use http/https");
 return u.toString();
}
function cleanSteps(steps){
 if(!Array.isArray(steps)||steps.length===0||steps.length>20) throw new Error("interaction steps out of bounds");
 return steps.map(step=>{
  if(!step||!STEPS.has(step.action)) throw new Error("unsupported interaction step");
  if(step.action==="wait"){
   const ms=Number(step.ms);
   if(!Number.isFinite(ms)||ms<0||ms>10000) throw new Error("wait out of bounds");
   return {action:"wait",ms};
  }
  if(typeof step.selector!=="string"||step.selector.length<1||step.selector.length>500) throw new Error("selector out of bounds");
  if(step.action==="type"){
   if(typeof step.text!=="string"||step.text.length>5000) throw new Error("type text out of bounds");
   return {action:"type",selector:step.selector,text:step.text};
  }
  if(step.action==="extract"){
   return {action:"extract",selector:step.selector};
  }
  return {action:"click",selector:step.selector};
 });
}

export function createBrowserControl({submit}={}) {
 if(typeof submit!=="function") throw new TypeError("server-side browser submit function required");
 const send=async(action,payload={})=>{
  if(!ACTIONS.has(action)) throw new Error("unsupported browser action");
  return submit({action,...payload});
 };
 return Object.freeze({
  navigate:target=>send("navigate",{target:validateUrl(target)}),
  scrape:target=>send("scrape",{target:validateUrl(target)}),
  screenshot:target=>send("screenshot",{target:validateUrl(target)}),
  interact:steps=>send("interact",{steps:cleanSteps(steps)}),
  closeSession:sessionId=>{
   if(typeof sessionId!=="string"||sessionId.length>200) throw new Error("session id out of bounds");
   return send("close_session",{sessionId});
  }
 });
}
