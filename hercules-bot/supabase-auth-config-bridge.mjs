const DEFAULT_SITE="https://smallz-hercules.onrender.com";
const DEFAULT_REDIRECT=DEFAULT_SITE+"/app";
const CREDENTIAL_FIELDS=new Set(["token","password","secret","apiKey","api_key","authorization","serviceRole","service_role","managementToken","management_token"]);

function assertClean(input={}){
 for(const key of Object.keys(input))if(CREDENTIAL_FIELDS.has(key))throw new Error("credential-fields-rejected");
}

export function createSupabaseAuthConfigBridge({
 projectRef=process.env.SUPABASE_PROJECT_REF,
 managementToken=process.env.SUPABASE_MANAGEMENT_TOKEN,
 request
}={}){
 const send=request??(async({url,method,authorization,body})=>fetch(url,{
  method,
  headers:{authorization,"content-type":"application/json"},
  body:JSON.stringify(body),
  signal:AbortSignal.timeout(30000)
 }));
 async function configureSmallz(input={}){
  assertClean(input);
  if(!projectRef)throw new Error("project-ref-required");
  if(!managementToken)throw new Error("management-authority-required");
  const body={site_url:DEFAULT_SITE,uri_allow_list:DEFAULT_REDIRECT};
  const response=await send({
   url:`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/config/auth`,
   method:"PATCH",
   authorization:`Bearer ${managementToken}`,
   body
  });
  if(!response?.ok)throw Object.assign(new Error("supabase-auth-config-update-failed"),{status:response?.status});
  const result=await response.json();
  return Object.freeze({ok:true,siteUrl:result?.site_url??body.site_url,redirectUrl:DEFAULT_REDIRECT});
 }
 return Object.freeze({configureSmallz});
}
