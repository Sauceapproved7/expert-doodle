import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const A=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY")||"";
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(U,S,{auth:{persistSession:false}});
const RESOURCE_META="https://mcp.spaceship.com/.well-known/oauth-protected-resource";
const AUTH_META="https://id.service.spaceship.com/.well-known/oauth-authorization-server";
const MCP_URL="https://mcp.spaceship.com/mcp";
const AUTHORIZATION_ENDPOINT="https://id.service.spaceship.com/connect/authorize";
const TOKEN_ENDPOINT="https://id.service.spaceship.com/connect/token";
const REGISTRATION_ENDPOINT="https://mcp.spaceship.com/register";
const SCOPE="openid offline_access mcp.spaceship.com";
const CALLBACK=U+"/functions/v1/hercules-private-bridge?spaceship_mcp_oauth_callback=1";
const DOMAIN="sauceapproved.com";
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:H})}
function html(body:string,status=200){return new Response(body,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}})}
function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function randomToken(bytes=48){const out=new Uint8Array(bytes);crypto.getRandomValues(out);return b64url(out)}
async function sha256b64url(value:string){return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))))}
async function sha256hex(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("")}

async function owner(req:Request){
  const h=req.headers.get("authorization")||"",token=h.startsWith("Bearer ")?h.slice(7):"";
  if(!token)return null;
  const db=createClient(U,A,{auth:{persistSession:false},global:{headers:{Authorization:"Bearer "+token}}});
  const {data,error}=await db.auth.getUser(token); if(error||!data.user)return null;
  const {data:m}=await db.from("hercules_memberships").select("organization_id,role,status")
    .eq("user_id",data.user.id).eq("status","active").in("role",["owner","admin"]).limit(1).maybeSingle();
  return m?{user:data.user,m}:null;
}
async function internalAuthorized(req:Request){
  const key=req.headers.get("x-hercules-internal-key")||""; if(!key)return false;
  const digest=await sha256hex(key);
  const {data}=await admin.from("hercules_internal_service_keys").select("key_sha256,enabled")
    .eq("purpose","spaceship-dns").eq("enabled",true).maybeSingle();
  return Boolean(data?.enabled&&data.key_sha256===digest);
}
async function secret(ref:string|null|undefined){
  if(!ref)throw new Error("spaceship_mcp_secret_ref_missing");
  const {data,error}=await admin.rpc("hercules_get_secret",{p_id:ref});
  if(error||!data)throw new Error("spaceship_mcp_secret_unavailable");
  return String(data);
}
async function resourceMetadata(){
  const r=await fetch(RESOURCE_META,{headers:{accept:"application/json"},signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error("spaceship_oauth_resource_discovery_failed:"+r.status);
  return body;
}
async function authorizationMetadata(){
  const r=await fetch(AUTH_META,{headers:{accept:"application/json"},signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error("spaceship_oauth_authorization_discovery_failed:"+r.status);
  return body;
}
async function metadata(){
  const resource=await resourceMetadata();
  const issuer=String(resource?.authorization_servers?.[0]||"");
  if(issuer!=="https://id.service.spaceship.com")throw new Error("spaceship_oauth_issuer_untrusted");
  const oauth=await authorizationMetadata();
  if(String(oauth?.issuer||"")!==issuer)throw new Error("spaceship_oauth_metadata_mismatch");
  if(
    String(oauth?.authorization_endpoint||"")!==AUTHORIZATION_ENDPOINT ||
    String(oauth?.token_endpoint||"")!==TOKEN_ENDPOINT ||
    String(oauth?.registration_endpoint||"")!==REGISTRATION_ENDPOINT
  )throw new Error("spaceship_oauth_metadata_endpoint_mismatch");
  return {resource,oauth};
}
async function row(){
  const {data,error}=await admin.from("hercules_spaceship_mcp_oauth").select("*").eq("singleton",true).maybeSingle();
  if(error)throw new Error("spaceship_mcp_state_read_failed");
  return data||{};
}
async function ensureRegistration(){
  const current=await row();
  const discovered=await metadata();
  if(current?.client_id){
    return {
      clientId:String(current.client_id),
      clientSecret:current?.client_secret_secret_ref?await secret(current.client_secret_secret_ref):"",
      redirectUri:String(current.redirect_uri||CALLBACK),
      discovered
    };
  }
  const response=await fetch(REGISTRATION_ENDPOINT,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({
      client_name:"Hercules SauceApproved DNS",
      redirect_uris:[CALLBACK],
      grant_types:["authorization_code","refresh_token"],
      response_types:["code"],
      token_endpoint_auth_method:"client_secret_post",
      scope:SCOPE
    }),
    signal:AbortSignal.timeout(15000)
  });
  const reg=await response.json().catch(()=>({}));
  const regBody=reg?.data&&typeof reg.data==="object"?reg.data:reg;
  const clientId=String(regBody?.client_id||regBody?.clientId||"").trim();
  const clientSecret=String(regBody?.client_secret||regBody?.clientSecret||"").trim();
  const authMethod=String(regBody?.token_endpoint_auth_method||"").trim();
  const publicClient=authMethod==="none"&&!clientSecret;
  const confidentialClient=["client_secret_post","client_secret_basic"].includes(authMethod)&&Boolean(clientSecret);
  if(!response.ok||!clientId||(!publicClient&&!confidentialClient)){
    const registration_response_fields=Object.keys(regBody&&typeof regBody==="object"?regBody:{}).sort().slice(0,32).join(",");
    throw new Error("spaceship_mcp_dynamic_registration_failed:"+response.status+":registration_response_fields="+registration_response_fields+":registration_auth_method="+authMethod);
  }
  const {data,error}=await admin.rpc("hercules_spaceship_mcp_store_registration",{
    p_client_id:clientId,p_client_secret:clientSecret,p_redirect_uri:CALLBACK
  });
  if(error||data!==true)throw new Error("spaceship_mcp_registration_store_failed");
  return {clientId,clientSecret,redirectUri:CALLBACK,discovered};
}
async function beginAuthorization(){
  const reg=await ensureRegistration();
  const state=randomToken(32),verifier=randomToken(48),challenge=await sha256b64url(verifier);
  const {data,error}=await admin.rpc("hercules_spaceship_mcp_begin_authorization",{p_state:state,p_verifier:verifier});
  if(error||data!==true)throw new Error("spaceship_mcp_authorization_state_store_failed");
  const url=new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id",reg.clientId);
  url.searchParams.set("redirect_uri",reg.redirectUri);
  url.searchParams.set("response_type","code");
  url.searchParams.set("scope",SCOPE);
  url.searchParams.set("state",state);
  url.searchParams.set("code_challenge",challenge);
  url.searchParams.set("code_challenge_method","S256");
  url.searchParams.set("resource","https://mcp.spaceship.com/");
  return {authorizationUrl:url.toString(),provider:"spaceship-mcp",status:"authorization_required",scope:SCOPE};
}
async function postToken(params:URLSearchParams){
  const r=await fetch(TOKEN_ENDPOINT,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},body:params.toString(),signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body?.access_token)throw new Error("spaceship_mcp_token_exchange_failed:"+r.status);
  return body;
}
async function completeCallback(url:URL){
  const oauthError=url.searchParams.get("error");
  if(oauthError)throw new Error("spaceship_oauth_denied:"+oauthError);
  const code=String(url.searchParams.get("code")||""),state=String(url.searchParams.get("state")||"");
  if(!code||!state)throw new Error("spaceship_oauth_callback_incomplete");
  const current=await row();
  if(current?.status!=="pending_authorization"||!current?.oauth_state_sha256||!current?.oauth_started_at)throw new Error("oauth_state_mismatch");
  if(await sha256hex(state)!==String(current.oauth_state_sha256))throw new Error("oauth_state_mismatch");
  if(Date.now()-new Date(current.oauth_started_at).getTime()>20*60*1000)throw new Error("oauth_state_mismatch");
  const verifier=await secret(current.pkce_verifier_secret_ref);
  const clientSecret=current?.client_secret_secret_ref?await secret(current.client_secret_secret_ref):"";
  const discovered=await metadata();
  const params=new URLSearchParams({
    grant_type:"authorization_code",
    code,
    redirect_uri:String(current.redirect_uri||CALLBACK),
    client_id:String(current.client_id),
    code_verifier:verifier,
    resource:"https://mcp.spaceship.com/"
  });
  if(clientSecret)params.set("client_secret",clientSecret);
  const token=await postToken(params);
  const expiresAt=new Date(Date.now()+Math.max(60,Number(token.expires_in||3600))*1000).toISOString();
  const {data,error}=await admin.rpc("hercules_spaceship_mcp_complete_authorization",{
    p_state:state,
    p_access_token:String(token.access_token),
    p_refresh_token:String(token.refresh_token||""),
    p_expires_at:expiresAt,
    p_scope:String(token.scope||SCOPE)
  });
  if(error||data!==true)throw new Error("spaceship_mcp_authorization_store_failed");
  const {data:autopilot}=await admin.rpc("hercules_domain_launch_autopilot_tick");
  return {ok:true,provider:"spaceship-mcp",status:"configured",autopilot:autopilot||null};
}
async function accessToken(){
  const current=await row();
  if(current?.status!=="configured"||!current?.access_token_secret_ref)throw new Error("spaceship_mcp_authorization_required");
  const expires=current?.token_expires_at?new Date(current.token_expires_at).getTime():0;
  if(expires>Date.now()+60000)return await secret(current.access_token_secret_ref);
  if(!current?.refresh_token_secret_ref)throw new Error("spaceship_mcp_refresh_token_missing");
  const refresh=await secret(current.refresh_token_secret_ref);
  const clientSecret=current?.client_secret_secret_ref?await secret(current.client_secret_secret_ref):"";
  const discovered=await metadata();
  const params=new URLSearchParams({
    grant_type:"refresh_token",
    refresh_token:refresh,
    client_id:String(current.client_id),
    scope:String(current.scope||SCOPE),
    resource:"https://mcp.spaceship.com/"
  });
  if(clientSecret)params.set("client_secret",clientSecret);
  const token=await postToken(params);
  const expiresAt=new Date(Date.now()+Math.max(60,Number(token.expires_in||3600))*1000).toISOString();
  const nextRefresh=String(token.refresh_token||refresh);
  const {data,error}=await admin.rpc("hercules_spaceship_mcp_refresh_tokens",{
    p_access_token:String(token.access_token),p_refresh_token:nextRefresh,p_expires_at:expiresAt,p_scope:String(token.scope||current.scope||SCOPE)
  });
  if(error||data!==true)throw new Error("spaceship_mcp_refresh_store_failed");
  return String(token.access_token);
}
function parseRpc(text:string,contentType:string){
  if(!text)return null;
  if(contentType.includes("text/event-stream")){
    const events=text.split(/\r?\n/).filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trim()).filter(Boolean);
    for(let i=events.length-1;i>=0;i--){try{return JSON.parse(events[i])}catch{}}
    throw new Error("spaceship_mcp_sse_parse_failed");
  }
  try{return JSON.parse(text)}catch{throw new Error("spaceship_mcp_json_parse_failed")}
}
async function mcpRpc(token:string,payload:any,sessionId=""){
  const headers:Record<string,string>={
    authorization:"Bearer "+token,
    "content-type":"application/json",
    accept:"application/json, text/event-stream"
  };
  if(sessionId)headers["mcp-session-id"]=sessionId;
  const r=await fetch(MCP_URL,{method:"POST",headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  const text=await r.text(),contentType=r.headers.get("content-type")||"";
  if(!r.ok)throw new Error("spaceship_mcp_http_"+r.status+":"+text.slice(0,300));
  return {body:parseRpc(text,contentType),sessionId:r.headers.get("mcp-session-id")||sessionId};
}
function toolData(rpc:any){
  if(rpc?.error)throw new Error("spaceship_mcp_rpc_error:"+String(rpc.error?.message||"unknown"));
  const result=rpc?.result;
  if(result?.isError)throw new Error("spaceship_mcp_tool_error");
  if(result?.structuredContent)return result.structuredContent;
  for(const part of Array.isArray(result?.content)?result.content:[]){
    if(part?.type==="text"&&typeof part?.text==="string"){
      try{return JSON.parse(part.text)}catch{}
    }
  }
  return result||{};
}
async function callTool(name:string,args:any){
  const token=await accessToken();
  const init=await mcpRpc(token,{jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"Hercules",version:"1.0.0"}}});
  if(!init.body?.result)throw new Error("spaceship_mcp_initialize_failed");
  await mcpRpc(token,{jsonrpc:"2.0",method:"notifications/initialized",params:{}},init.sessionId);
  const call=await mcpRpc(token,{jsonrpc:"2.0",id:2,method:"tools/call",params:{name,arguments:args}},init.sessionId);
  return toolData(call.body);
}
async function status(){
  const current=await row();
  return {
    ok:true,provider:"spaceship-mcp",domain:DOMAIN,status:String(current?.status||"unconfigured"),
    authorizedAt:current?.authorized_at||null,tokenExpiresAt:current?.token_expires_at||null,
    scope:String(current?.scope||SCOPE),secretExposure:false
  };
}
function safeDnsArgs(action:string,args:any){
  const domainName=String(args?.domainName||"").toLowerCase().replace(/\.$/,"");
  if(domainName!==DOMAIN)throw new Error("spaceship_mcp_domain_not_allowed");
  if(action==="dns_records_get")return {domainName:DOMAIN,take:Math.max(1,Math.min(500,Number(args?.take||500))),skip:Math.max(0,Number(args?.skip||0))};
  const records=Array.isArray(args?.records)?args.records.slice(0,500):[];
  if(records.length<1)throw new Error("spaceship_mcp_records_required");
  if(action==="dns_records_save")return {domainName:DOMAIN,records,force:args?.force===true};
  return {domainName:DOMAIN,records};
}

export function isSpaceshipMcpAction(action:string){
  return [
    "spaceship_mcp_status",
    "spaceship_mcp_begin",
    "spaceship_mcp_dns_records_get",
    "spaceship_mcp_dns_records_save",
    "spaceship_mcp_dns_records_delete"
  ].includes(action);
}

export async function handleSpaceshipMcpRequest(req:Request){
  const url=new URL(req.url);
  if(req.method==="GET"&&url.searchParams.get("spaceship_mcp_oauth_callback")==="1"){
    try{
      const result=await completeCallback(url);
      if(url.searchParams.get("format")==="json")return json(result);
      return html("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Hercules · Spaceship connected</title></head><body><main><h1>Spaceship connected to Hercules</h1><p>Authorization is complete. Hercules has resumed the SauceApproved domain-launch workflow.</p></main></body></html>");
    }catch(e){
      const message=e instanceof Error?e.message:"spaceship_mcp_callback_failed";
      return html("<!doctype html><html><head><meta charset=\"utf-8\"><title>Hercules · Spaceship authorization</title></head><body><main><h1>Authorization was not completed</h1><p>"+message.replace(/[<>&]/g,"")+"</p></main></body></html>",400);
    }
  }
  if(req.method==="GET")return json({ok:true,service:"hercules-spaceship-mcp",version:"1.0.0",provider:"Spaceship",oauth:true,mcp:true,domain:DOMAIN});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);

  const internal=await internalAuthorized(req);
  const a=internal?null:await owner(req);
  if(!internal&&!a)return json({error:"owner_admin_or_internal_required"},403);
  const body=await req.json().catch(()=>({})),action=String(body?.action||"status");

  try{
    if(action==="spaceship_mcp_status")return json(await status());
    if(action==="spaceship_mcp_begin")return json({ok:true,...await beginAuthorization()});
    const toolMap:Record<string,string>={
      spaceship_mcp_dns_records_get:"dns_records_get",
      spaceship_mcp_dns_records_save:"dns_records_save",
      spaceship_mcp_dns_records_delete:"dns_records_delete"
    };
    const tool=toolMap[action];
    if(tool){
      if(!internal)return json({error:"internal_dns_control_required"},403);
      const args=safeDnsArgs(tool,body?.arguments||{});
      return json({ok:true,provider:"spaceship-mcp",tool,result:await callTool(tool,args)});
    }
    return json({error:"unsupported_action"},400);
  }catch(e){
    const detail=e instanceof Error?e.message.slice(0,1000):"spaceship_mcp_failed";
    const statusCode=detail==="spaceship_mcp_authorization_required"?409:502;
    return json({ok:false,error:detail},statusCode);
  }
}
