const ACTIONS=new Set(["bot_browser_navigate","bot_browser_scrape"]);
function ownerAuth(value){const v=String(value||"").trim();if(!v.startsWith("Bearer ")||v.length<=7)throw new Error("owner authorization required");return v}
export function createSmallzOwnerBridge({endpoint,fetchImpl=fetch}={}){
 if(!endpoint)throw new Error("mcp work endpoint required");
 return async({ownerAuthorization,action,url}={})=>{
  const authorization=ownerAuth(ownerAuthorization);
  if(!ACTIONS.has(action))throw new Error("action denied");
  const target=new URL(String(url)); if(!["http:","https:"].includes(target.protocol))throw new Error("target must use http/https");
  const response=await fetchImpl(endpoint,{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify({action,url:target.toString()}),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Object.assign(new Error("smallz owner bridge request failed"),{status:response.status});
  return response.json();
 };
}
