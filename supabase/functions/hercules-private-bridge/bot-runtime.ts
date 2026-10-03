import {createClient} from "npm:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")!;
const P=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY")||"";
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(U,S,{auth:{persistSession:false}});
const H={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const rejected=new Set(["token","password","secret","apiKey","api_key","authorization","serviceRole","service_role"]);

export function isBotRuntimeRequest(url:URL){return url.searchParams.get("bot_runtime")==="1";}

async function owner(req:Request){
 const h=req.headers.get("authorization")||"", token=h.startsWith("Bearer ")?h.slice(7):"";
 if(!token)return null;
 const db=createClient(U,P,{auth:{persistSession:false},global:{headers:{Authorization:"Bearer "+token}}});
 const {data,error}=await db.auth.getUser(token); if(error||!data.user)return null;
 const {data:m}=await db.from("hercules_memberships").select("organization_id,role,status").eq("user_id",data.user.id).eq("status","active").in("role",["owner","admin"]).limit(1).maybeSingle();
 return m?{user:data.user,m}:null;
}
async function internalKey(purpose:string){
 const {data:row,error}=await admin.from("hercules_internal_service_keys").select("secret_ref,enabled").eq("purpose",purpose).eq("enabled",true).maybeSingle();
 if(error||!row?.secret_ref)throw new Error("service_identity_unavailable");
 const {data:key,error:keyError}=await admin.rpc("hercules_get_secret",{p_id:row.secret_ref});
 if(keyError||!key)throw new Error("service_identity_unavailable");
 return String(key);
}
function safeUrl(raw:unknown){
 let u:URL; try{u=new URL(String(raw||""));}catch{throw new Error("invalid_browser_url")}
 const h=u.hostname.toLowerCase();
 if(u.protocol!=="https:")throw new Error("invalid_browser_url");
 if(h==="localhost"||h.endsWith(".local")||h==="0.0.0.0"||h==="127.0.0.1"||h==="::1")throw new Error("invalid_browser_url");
 if(/^10\\./.test(h)||/^192\\.168\\./.test(h)||/^169\\.254\\./.test(h))throw new Error("invalid_browser_url");
 const m=/^172\\.(\\d+)\\./.exec(h); if(m&&Number(m[1])>=16&&Number(m[1])<=31)throw new Error("invalid_browser_url");
 return u.toString();
}
export async function handleBotRuntimeRequest(req:Request){
 if(req.method==="GET")return out({ok:true,service:"hercules-bot-runtime",version:"1.0.0",actions:["browser.navigate","browser.scrape","deploy.status"],productionDeployMutation:false});
 if(req.method!=="POST")return out({error:"method_not_allowed"},405);
 const a=await owner(req); if(!a)return out({error:"owner_or_admin_required"},403);
 const body=await req.json().catch(()=>({}));
 for(const key of Object.keys(body))if(rejected.has(key))return out({error:"credential_field_rejected"},400);
 const action=String(body.action||"");
 try{
  if(action==="browser.navigate"||action==="browser.scrape"){
   const key=await internalKey("browser-gateway");
   const response=await fetch(U+"/functions/v1/hercules-browser",{method:"POST",headers:{"content-type":"application/json","x-hercules-internal-key":key},body:JSON.stringify({action:action.endsWith("navigate")?"navigate":"scrape",url:safeUrl(body.url),source:"hercules-bot-runtime"}),signal:AbortSignal.timeout(120000)});
   const result=await response.json().catch(()=>({}));
   return out({ok:response.ok,action,result},response.ok?200:502);
  }
  if(action==="deploy.status"){
   const response=await fetch(U+"/functions/v1/hercules-deploy",{method:"GET",signal:AbortSignal.timeout(20000)});
   const result=await response.json().catch(()=>({}));
   return out({ok:response.ok,action,result},response.ok?200:502);
  }
  return out({error:"unsupported_runtime_action"},400);
 }catch(e){return out({error:e instanceof Error?e.message:"runtime_failure"},503)}
}
