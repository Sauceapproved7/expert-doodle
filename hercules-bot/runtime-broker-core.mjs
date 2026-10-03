const CREDENTIAL_FIELDS=new Set(["token","password","secret","apiKey","api_key","authorization","serviceRole","service_role"]);
export function authorizeBotRuntime(membership){
 return Boolean(membership&&membership.status==="active"&&["owner","admin"].includes(membership.role));
}
function rejectCredentials(input){
 for(const key of Object.keys(input||{})) if(CREDENTIAL_FIELDS.has(key)) throw new Error("credential field rejected");
}
export function normalizeBotRuntimeCommand(input={}){
 rejectCredentials(input);
 const action=String(input.action||"");
 if(action==="browser.navigate"){
  let url; try{url=new URL(String(input.url||""));}catch{throw new Error("invalid browser url")}
  if(!["http:","https:"].includes(url.protocol)) throw new Error("invalid browser url");
  return {action,url:url.toString()};
 }
 if(action==="browser.scrape"){
  let url; try{url=new URL(String(input.url||""));}catch{throw new Error("invalid browser url")}
  if(!["http:","https:"].includes(url.protocol)) throw new Error("invalid browser url");
  return {action,url:url.toString()};
 }
 if(action==="deploy.status") return {action};
 throw new Error("unsupported runtime action");
}
