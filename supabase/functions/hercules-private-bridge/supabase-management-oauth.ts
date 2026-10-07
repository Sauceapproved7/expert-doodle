import {createClient} from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const A=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY")||"";
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(U,S,{auth:{persistSession:false}});
const AUTHORIZE="https://api.supabase.com/v1/oauth/authorize";
const TOKEN="https://api.supabase.com/v1/oauth/token";
const PROJECT="xbwuablxhhwsaoomsoco";
const CALLBACK=U+"/functions/v1/hercules-private-bridge?supabase_management_oauth_callback=1";
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});

function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function randomToken(bytes=48){const out=new Uint8Array(bytes);crypto.getRandomValues(out);return b64url(out)}
async function challenge(value:string){return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))))}
async function owner(req:Request){
  const h=req.headers.get("authorization")||"",token=h.startsWith("Bearer ")?h.slice(7):"";
  if(!token)return null;
  const db=createClient(U,A,{auth:{persistSession:false},global:{headers:{Authorization:"Bearer "+token}}});
  const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;
  const {data:m}=await db.from("hercules_memberships").select("role,status").eq("user_id",data.user.id).eq("status","active").eq("role","owner").limit(1).maybeSingle();
  return m?data.user:null;
}
async function secret(ref:string|null|undefined){
  if(!ref)throw new Error("supabase_management_secret_ref_missing");
  const {data,error}=await admin.rpc("hercules_get_secret",{p_id:ref});
  if(error||!data)throw new Error("supabase_management_secret_unavailable");
  return String(data);
}
async function row(){
  const {data,error}=await admin.from("hercules_supabase_management_oauth").select("*").eq("singleton",true).maybeSingle();
  if(error)throw new Error("supabase_management_state_read_failed");
  return data||{};
}
async function basic(clientId:string,clientSecret:string){return "Basic "+btoa(clientId+":"+clientSecret)}
async function tokenRequest(clientId:string,clientSecret:string,params:URLSearchParams){
  const response=await fetch(TOKEN,{method:"POST",redirect:"error",headers:{authorization:await basic(clientId,clientSecret),accept:"application/json","content-type":"application/x-www-form-urlencoded"},body:params.toString(),signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body?.access_token)throw new Error("supabase_management_token_exchange_failed");
  return body;
}
async function enableHerculesOAuthServer(accessToken:string){
  const endpoint="https://api.supabase.com/v1/projects/"+PROJECT+"/config/auth";
  const desired={oauth_server_enabled:true,oauth_server_allow_dynamic_registration:true,oauth_server_authorization_path:"/oauth/consent"};
  const response=await fetch(endpoint,{method:"PATCH",redirect:"error",headers:{authorization:"Bearer "+accessToken,accept:"application/json","content-type":"application/json"},body:JSON.stringify(desired),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("supabase_management_auth_config_update_failed:"+response.status);
  const verify=await fetch(endpoint,{headers:{authorization:"Bearer "+accessToken,accept:"application/json"},signal:AbortSignal.timeout(15000)});
  const body=await verify.json().catch(()=>({}));
  if(!verify.ok||body.oauth_server_enabled!==true||body.oauth_server_allow_dynamic_registration!==true||body.oauth_server_authorization_path!=="/oauth/consent")throw new Error("supabase_management_auth_config_verification_failed");
  return true;
}
async function begin(req:Request){
  if(!await owner(req))return json({error:"owner_required"},403);
  const current=await row();
  if(!current.client_id||!current.client_secret_secret_ref)return json({error:"supabase_management_oauth_app_configuration_required",secretExposure:false},409);
  const state=randomToken(32),verifier=randomToken(48);
  const {data,error}=await admin.rpc("hercules_supabase_management_begin_authorization",{p_state:state,p_verifier:verifier});
  if(error||data!==true)throw new Error("supabase_management_authorization_state_store_failed");
  const url=new URL(AUTHORIZE);
  url.searchParams.set("client_id",String(current.client_id));
  url.searchParams.set("response_type","code");
  url.searchParams.set("redirect_uri",CALLBACK);
  url.searchParams.set("state",state);
  url.searchParams.set("code_challenge",await challenge(verifier));
  url.searchParams.set("code_challenge_method","S256");
  return json({ok:true,action:"supabase_management_oauth_start",authorizationUrl:url.toString(),secretExposure:false});
}
async function callback(url:URL){
  const code=String(url.searchParams.get("code")||""),state=String(url.searchParams.get("state")||"");
  if(!code||!state)return json({error:"oauth_callback_parameters_required"},400);
  const current=await row();
  const verifier=await secret(current.pkce_verifier_secret_ref);
  const clientSecret=await secret(current.client_secret_secret_ref);
  const tokens=await tokenRequest(String(current.client_id),clientSecret,new URLSearchParams([["grant_type","authorization_code"],["code",code],["redirect_uri",CALLBACK],["code_verifier",verifier]]));
  const expiresAt=new Date(Date.now()+Math.max(60,Number(tokens.expires_in||3600))*1000).toISOString();
  const {data,error}=await admin.rpc("hercules_supabase_management_complete_authorization",{p_state:state,p_access_token:String(tokens.access_token),p_refresh_token:String(tokens.refresh_token||""),p_expires_at:expiresAt});
  if(error||data!==true)throw new Error("oauth_state_mismatch");
  await enableHerculesOAuthServer(String(tokens.access_token));
  return json({ok:true,status:"configured",projectRef:PROJECT,secretExposure:false});
}
export async function handleSupabaseManagementOAuthRequest(req:Request){
  try{
    const url=new URL(req.url);
    if(url.searchParams.get("supabase_management_oauth_callback")==="1")return callback(url);
    if(req.method!=="POST")return json({error:"method_not_allowed"},405);
    const body=await req.json().catch(()=>({}));
    if(String(body?.action||"")==="supabase_management_oauth_start")return begin(req);
    return json({error:"unknown_action"},400);
  }catch(error){return json({error:error instanceof Error?error.message:"supabase_management_oauth_failed"},500)}
}
