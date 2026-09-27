import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=Deno.env.get('SUPABASE_ANON_KEY')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_BODY_BYTES=256*1024;
const ORIGIN='https://agent.sauceapproved.com';
const OWNER_ONLY=new Set([
  'payments',
  'private_credentials_or_2fa',
  'identity_verification',
  'legally_binding_consent',
  'required_permission_grants',
  'irreversible_high_impact_owner_decisions',
  'physical_world_actions',
  'information_only_the_owner_possesses'
]);

const admin=createClient(U,S,{auth:{persistSession:false}});

function out(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer',
      'permissions-policy':'camera=(), microphone=(), geolocation=()'
    }
  });
}

async function sha256(value:string){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
}

function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

async function internalAuthorized(req:Request){
  const key=req.headers.get('x-hercules-internal-key')||'';
  if(!key)return false;
  const digest=await sha256(key);
  const {data,error}=await admin.from('hercules_internal_service_keys')
    .select('key_sha256,enabled')
    .eq('purpose','domain-agent-control')
    .eq('enabled',true)
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data?.enabled&&data?.key_sha256) && safeEqual(String(data.key_sha256),digest);
}

async function ownerOrAdmin(req:Request){
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return null;
  const db=createClient(U,A,{
    global:{headers:{Authorization:auth}},
    auth:{persistSession:false}
  });
  const {data:{user}}=await db.auth.getUser();
  if(!user)return null;
  const {data,error}=await db.from('hercules_memberships')
    .select('organization_id,role,status')
    .eq('user_id',user.id)
    .eq('status','active')
    .in('role',['owner','admin'])
    .limit(1)
    .maybeSingle();
  if(error||!data)return null;
  return {userId:user.id,organizationId:String(data.organization_id),role:String(data.role)};
}

async function readJson(req:Request){
  const declared=Number(req.headers.get('content-length')||'0');
  if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES){
    throw Object.assign(new Error('request_body_too_large'),{status:413});
  }
  const bytes=new Uint8Array(await req.arrayBuffer());
  if(bytes.byteLength>MAX_BODY_BYTES){
    throw Object.assign(new Error('request_body_too_large'),{status:413});
  }
  if(bytes.byteLength===0)return {};
  try{
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch{
    throw Object.assign(new Error('invalid_json'),{status:400});
  }
}

function strings(value:unknown,name:string){
  if(value==null)return [];
  if(!Array.isArray(value))throw Object.assign(new Error(name+'_must_be_array'),{status:400});
  if(value.length>32)throw Object.assign(new Error(name+'_too_many'),{status:400});
  const result=[...new Set(value.map(x=>String(x).trim().toLowerCase()).filter(Boolean))].sort();
  if(result.some(x=>x.length>128||!/^[a-z0-9][a-z0-9._:-]*$/.test(x))){
    throw Object.assign(new Error(name+'_invalid'),{status:400});
  }
  return result;
}

async function resolveOrganization(req:Request,body:any){
  const internal=await internalAuthorized(req);
  if(internal){
    const organizationId=String(body.organization_id||'').trim();
    if(!/^[0-9a-f-]{36}$/i.test(organizationId)){
      throw Object.assign(new Error('organization_id_required'),{status:400});
    }
    const {data}=await admin.from('hercules_organizations')
      .select('id,status').eq('id',organizationId).eq('status','active').limit(1).maybeSingle();
    if(!data)throw Object.assign(new Error('organization_not_active'),{status:403});
    return {organizationId,principal:'hercules-internal',internal:true};
  }

  const owner=await ownerOrAdmin(req);
  if(!owner)throw Object.assign(new Error('owner_admin_or_internal_authorization_required'),{status:401});
  return {organizationId:owner.organizationId,principal:owner.userId,internal:false};
}

function discovery(){
  return {
    schema:'hercules.domain-agent.discovery.v1',
    agent:{
      id:'hercules-domain-agent',
      subject:ORIGIN+'/agents/hercules-domain-agent',
      origin:ORIGIN
    },
    deployment:{
      backend:'supabase-edge',
      domainBinding:'pending_dns_and_provider_verification'
    },
    endpoints:{
      discovery:ORIGIN+'/.well-known/hercules-agent.json',
      health:ORIGIN+'/health',
      tasks:ORIGIN+'/v1/tasks'
    },
    capabilities:{
      providerGrantReuse:true,
      automaticRefresh:true,
      tenantIsolation:true,
      ownerBoundaryDetection:true,
      credentialIsolation:true,
      authorizationResolver:true,
      executionAdapters:false
    },
    security:{
      failClosed:true,
      rawCredentialsAccepted:false,
      bypassAuthorization:false,
      bypass2FA:false,
      bypassProviderControls:false
    }
  };
}

async function resolveGrant(organizationId:string,body:any){
  const provider=String(body.provider||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(provider)){
    throw Object.assign(new Error('valid_provider_required'),{status:400});
  }
  const accountKey=body.account_key==null?null:String(body.account_key).trim();
  if(accountKey&&accountKey.length>512)throw Object.assign(new Error('account_key_too_long'),{status:400});
  const requiredCapabilities=strings(body.required_capabilities,'required_capabilities');

  const {data,error}=await admin.rpc('hercules_domain_agent_resolve_provider_grant',{
    p_organization_id:organizationId,
    p_provider:provider,
    p_account_key:accountKey,
    p_required_capabilities:requiredCapabilities
  });
  if(error)throw new Error('grant_resolution_failed:'+error.message);
  return data;
}

async function decisionHash(value:unknown){
  return sha256(JSON.stringify(value));
}

Deno.serve(async(req:Request)=>{
  try{
    const url=new URL(req.url);
    const path=url.pathname;

    if(req.method==='GET' && (path.endsWith('/.well-known/hercules-agent.json')||url.searchParams.get('discovery')==='1')){
      return out(discovery());
    }

    if(req.method==='GET' && (path.endsWith('/health')||path.endsWith('/hercules-domain-agent'))){
      return out({
        ok:true,
        service:'hercules-domain-agent',
        version:'1.0.0',
        schema:'hercules.domain-agent.health.v1',
        intendedOrigin:ORIGIN,
        backendLive:true,
        customDomainVerified:false,
        executionAuthority:false
      });
    }

    if(req.method!=='POST')return out({error:'method_not_allowed'},405);

    const body:any=await readJson(req);
    const action=String(body.action||'task_preflight');
    if(!['grant_status','task_preflight'].includes(action)){
      return out({error:'unknown_action'},400);
    }

    const principal=await resolveOrganization(req,body);

    if(action==='task_preflight' && body.owner_boundary!=null){
      const boundary=String(body.owner_boundary);
      if(!OWNER_ONLY.has(boundary)){
        return out({error:'invalid_owner_boundary'},400);
      }
      const response={
        schema:'hercules.domain-agent.preflight.v1',
        disposition:'OWNER_ACTION_REQUIRED',
        status:'owner_action_required',
        organization_id:principal.organizationId,
        owner_boundary:boundary,
        execution_eligible:false,
        execution_authority:false,
        reason_codes:['OWNER_ONLY_BOUNDARY']
      };
      return out({...response,decision_sha256:await decisionHash(response)},409);
    }

    const grant=await resolveGrant(principal.organizationId,body);

    if(action==='grant_status'){
      return out({
        ok:true,
        service:'hercules-domain-agent',
        organization_id:principal.organizationId,
        grant
      });
    }

    const eligible=Boolean(grant?.execution_eligible);
    const ownerRequired=Boolean(grant?.owner_action_required);
    const disposition=eligible?'EXECUTE_ELIGIBLE':ownerRequired?'OWNER_ACTION_REQUIRED':'DENY';
    const status=eligible?'execution_eligible':ownerRequired?'owner_action_required':'denied';
    const response={
      schema:'hercules.domain-agent.preflight.v1',
      disposition,
      status,
      organization_id:principal.organizationId,
      provider:grant?.provider??null,
      account_key:grant?.account_key??null,
      connection_ref:grant?.connection_ref??null,
      authorization_evidence_sha256:grant?.authorization_evidence_sha256??null,
      capabilities:grant?.capabilities??[],
      missing_capabilities:grant?.missing_capabilities??[],
      refreshable:Boolean(grant?.refreshable),
      refresh_mode:grant?.refresh_mode??'none',
      execution_eligible:eligible,
      execution_authority:false,
      owner_action_required:ownerRequired,
      credential_custody:'supabase_vault',
      carries_credentials:false,
      reason_codes:grant?.reason_codes??['AUTHORIZATION_UNRESOLVED']
    };
    return out(
      {...response,decision_sha256:await decisionHash(response)},
      eligible?200:ownerRequired?409:403
    );
  }catch(error){
    const status=Number((error as any)?.status)||500;
    return out({
      error:status>=500?'internal_error':error instanceof Error?error.message:String(error)
    },status);
  }
});
