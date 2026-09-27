import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||'';
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=createClient(U,S,{auth:{persistSession:false}});
const MAX_BODY_BYTES=256*1024;
const ORIGIN='https://agent.sauceapproved.com';
const ACTIONS=new Set([
  'domain_agent_grant_status',
  'domain_agent_task_preflight',
  'domain_agent_execute',
  'domain_agent_execution_status',
  'domain_agent_usage_status',
  'domain_agent_identity_status',
  'domain_agent_api_key_issue',
  'domain_agent_api_key_revoke'
]);
const SAFE_WORKLOADS=new Set([
  'benchmark.echo',
  'crypto.sha256',
  'runtime.capabilities',
  'runtime.selftest'
]);
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
const SENSITIVE_KEYS=new Set([
  'password','secret','client_secret','access_token','refresh_token','token',
  'api_key','api_secret','cookie','cookies','authorization','otp','mfa','captcha'
]);
const PROVIDER_ADAPTERS:Record<string,{
  provider:string;
  capability:string;
  service:string;
  purpose?:string;
  action:string;
  ownerSession?:boolean;
}> = {
  'shopify.domain.observe':{
    provider:'shopify',
    capability:'shopify.domain.observe',
    service:'hercules-provider-connect',
    purpose:'shopify-domain-monitor',
    action:'monitor_shopify_domain'
  },
  'shopify.launch.read':{
    provider:'shopify',
    capability:'shopify.launch.read',
    service:'hercules-provider-connect',
    purpose:'shopify-launch-readiness',
    action:'monitor_shopify_launch'
  },
  'github.bridge.verify':{
    provider:'github_forge',
    capability:'github.bridge.verify',
    service:'hercules-github-app',
    purpose:'github-finalizer',
    action:'reconcile'
  },
  'knowledge.read':{
    provider:'google_drive',
    capability:'knowledge.read',
    service:'hercules-drive',
    action:'search',
    ownerSession:true
  }
};

type Principal={
  organizationId:string;
  principal:string;
  principalType:'owner-admin'|'hercules-internal'|'api-key';
  internal:boolean;
  userId?:string;
  apiKeyId?:string;
  authorizationHeader?:string;
};

const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer',
    'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()'
  }
});

async function sha256(value:string){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function randomHex(bytes=32){
  const raw=new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  return [...raw].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

function hasSensitiveInput(value:unknown,depth=0):boolean{
  if(depth>16)return true;
  if(!value||typeof value!=='object')return false;
  if(Array.isArray(value))return value.some(v=>hasSensitiveInput(v,depth+1));
  for(const [key,nested] of Object.entries(value as Record<string,unknown>)){
    if(SENSITIVE_KEYS.has(key.toLowerCase()))return true;
    if(hasSensitiveInput(nested,depth+1))return true;
  }
  return false;
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
  return !error&&Boolean(data?.enabled&&data?.key_sha256)&&safeEqual(String(data.key_sha256),digest);
}

async function internalServiceKey(purpose:string){
  const {data,error}=await admin.from('hercules_internal_service_keys')
    .select('secret_ref,enabled')
    .eq('purpose',purpose)
    .eq('enabled',true)
    .limit(1)
    .maybeSingle();
  if(error||!data?.enabled||!data?.secret_ref)throw new Error('internal_service_key_unavailable');
  const {data:key,error:keyError}=await admin.rpc('hercules_get_secret',{p_id:data.secret_ref});
  if(keyError||!key)throw new Error('internal_service_key_unavailable');
  return String(key);
}

async function ownerOrAdmin(req:Request){
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return null;
  const db=createClient(U,A,{
    global:{headers:{Authorization:auth}},
    auth:{persistSession:false}
  });
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user)return null;
  const {data,error}=await db.from('hercules_memberships')
    .select('organization_id,role,status')
    .eq('user_id',user.id)
    .eq('status','active')
    .in('role',['owner','admin'])
    .limit(1)
    .maybeSingle();
  if(error||!data)return null;
  return {
    userId:String(user.id),
    organizationId:String(data.organization_id),
    role:String(data.role),
    authorizationHeader:auth
  };
}

function scopeAllowed(scopes:string[],required:string){
  const set=new Set((scopes||[]).map(v=>String(v).trim().toLowerCase()));
  return set.has('*')||set.has('domain-agent:*')||set.has(required);
}

async function apiKeyPrincipal(req:Request,requiredScope:string){
  const raw=String(req.headers.get('x-hercules-api-key')||'').trim();
  if(!raw)return null;
  if(raw.length<16||raw.length>512)throw Object.assign(new Error('invalid_api_key'),{status:401});
  const digest=await sha256(raw);
  const {data,error}=await admin.rpc('hercules_api_key_lookup',{p_hash:digest});
  const row=Array.isArray(data)?data[0]:data;
  if(error||!row?.id)throw Object.assign(new Error('invalid_api_key'),{status:401});
  if(!scopeAllowed(row.scopes||[],requiredScope)){
    throw Object.assign(new Error('api_key_scope_required'),{status:403});
  }
  await admin.from('hercules_api_keys').update({last_used_at:new Date().toISOString()}).eq('id',row.id);
  return {apiKeyId:String(row.id),organizationId:String(row.organization_id)};
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
  try{return JSON.parse(new TextDecoder().decode(bytes))}
  catch{throw Object.assign(new Error('invalid_json'),{status:400})}
}

async function resolveOrganization(req:Request,body:any,requiredScope='domain-agent:read'):Promise<Principal>{
  if(await internalAuthorized(req)){
    const organizationId=String(body.organization_id||'').trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)){
      throw Object.assign(new Error('organization_id_required'),{status:400});
    }
    const {data,error}=await admin.from('hercules_organizations')
      .select('id,status').eq('id',organizationId).eq('status','active').limit(1).maybeSingle();
    if(error||!data)throw Object.assign(new Error('organization_not_active'),{status:403});
    return {
      organizationId,
      principal:'hercules-internal',
      principalType:'hercules-internal',
      internal:true
    };
  }

  const owner=await ownerOrAdmin(req);
  if(owner){
    return {
      organizationId:owner.organizationId,
      principal:owner.userId,
      principalType:'owner-admin',
      internal:false,
      userId:owner.userId,
      authorizationHeader:owner.authorizationHeader
    };
  }

  const key=await apiKeyPrincipal(req,requiredScope);
  if(key){
    return {
      organizationId:key.organizationId,
      principal:key.apiKeyId,
      principalType:'api-key',
      internal:false,
      apiKeyId:key.apiKeyId
    };
  }
  throw Object.assign(new Error('owner_admin_internal_or_api_key_authorization_required'),{status:401});
}

function discovery(){
  const bridge=U+'/functions/v1/hercules-private-bridge';
  return {
    schema:'hercules.domain-agent.discovery.v1',
    agent:{
      id:'hercules-domain-agent',
      subject:ORIGIN+'/agents/hercules-domain-agent',
      intendedOrigin:ORIGIN
    },
    deployment:{
      backend:'supabase-edge-multiplex',
      service:'hercules-private-bridge',
      backendEndpoint:bridge,
      customDomainVerified:false
    },
    endpoints:{
      backendDiscovery:bridge+'?domain_agent=discovery',
      backendHealth:bridge+'?domain_agent=health',
      intendedDiscovery:ORIGIN+'/.well-known/hercules-agent.json',
      intendedHealth:ORIGIN+'/health'
    },
    capabilities:{
      providerGrantReuse:true,
      refreshMetadata:true,
      providerNativeRefresh:true,
      automaticRefresh:true,
      tenantIsolation:true,
      ownerBoundaryDetection:true,
      credentialIsolation:true,
      authorizationResolver:true,
      decisionAudit:true,
      executionAdapters:true,
      safeInternalExecution:true,
      customerApiKeys:true,
      commercialMetering:true
    },
    refresh:{
      strategy:'provider-native-only',
      unsupportedOrMissingGrant:'OWNER_ACTION_REQUIRED'
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

async function entitlement(organizationId:string){
  const {data,error}=await admin.rpc('hercules_domain_agent_entitlement',{p_organization_id:organizationId});
  if(error)throw new Error('entitlement_resolution_failed');
  return data||{};
}

async function usageStatus(organizationId:string){
  const {data,error}=await admin.rpc('hercules_domain_agent_usage_status',{p_organization_id:organizationId});
  if(error)throw new Error('usage_status_failed');
  return data||{};
}

async function identityStatus(organizationId:string){
  const {data,error}=await admin.rpc('hercules_domain_agent_identity_status',{p_organization_id:organizationId});
  if(error)throw new Error('identity_status_failed');
  return data||{};
}

async function manageApiKey(req:Request,body:any,action:string){
  const owner=await ownerOrAdmin(req);
  if(!owner)throw Object.assign(new Error('owner_admin_required_for_api_key_management'),{status:403});

  if(action==='domain_agent_api_key_issue'){
    const name=String(body.name||'Domain Agent API').trim();
    if(name.length<1||name.length>80)throw Object.assign(new Error('valid_api_key_name_required'),{status:400});
    const scopes=strings(body.scopes??['domain-agent:read','domain-agent:execute'],'scopes');
    const allowed=new Set(['domain-agent:read','domain-agent:execute','domain-agent:*']);
    if(scopes.length<1||scopes.some(x=>!allowed.has(x))){
      throw Object.assign(new Error('invalid_domain_agent_api_key_scope'),{status:400});
    }
    let expiresAt:null|string=null;
    if(body.expires_at!=null){
      const when=new Date(String(body.expires_at));
      if(!Number.isFinite(when.getTime())||when.getTime()<=Date.now()){
        throw Object.assign(new Error('future_api_key_expiry_required'),{status:400});
      }
      expiresAt=when.toISOString();
    }
    const api_key_secret='hda_live_'+randomHex(32);
    const key_hash=await sha256(api_key_secret);
    const key_prefix=api_key_secret.slice(0,18);
    const {data,error}=await admin.from('hercules_api_keys').insert({
      organization_id:owner.organizationId,
      created_by:owner.userId,
      name,
      key_prefix,
      key_hash,
      scopes,
      status:'active',
      expires_at:expiresAt
    }).select('id,name,key_prefix,scopes,status,expires_at,created_at').single();
    if(error)throw new Error('api_key_issue_failed');
    return {
      ok:true,
      api_key:data,
      api_key_secret,
      secret_returned_once:true
    };
  }

  const keyId=String(body.api_key_id||'').trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(keyId)){
    throw Object.assign(new Error('valid_api_key_id_required'),{status:400});
  }
  const {data,error}=await admin.from('hercules_api_keys').update({
    status:'revoked',
    revoked_at:new Date().toISOString()
  }).eq('id',keyId).eq('organization_id',owner.organizationId)
    .select('id,name,key_prefix,scopes,status,expires_at,revoked_at').maybeSingle();
  if(error||!data)throw Object.assign(new Error('api_key_not_found'),{status:404});
  return {ok:true,api_key:data};
}

async function recordUsage(principal:Principal,requestId:string,metadata:Record<string,unknown>={}){
  const {data,error}=await admin.rpc('hercules_domain_agent_record_usage',{
    p_organization_id:principal.organizationId,
    p_request_id:requestId,
    p_metric:'execution',
    p_quantity:1,
    p_source:principal.principalType,
    p_metadata:metadata
  });
  if(error){
    const message=String(error.message||'');
    if(message.includes('domain_agent_usage_limit_exceeded')){
      throw Object.assign(new Error('domain_agent_usage_limit_exceeded'),{status:429});
    }
    if(message.includes('domain_agent_entitlement_required')){
      throw Object.assign(new Error('domain_agent_entitlement_required'),{status:402});
    }
    throw new Error('usage_record_failed');
  }
  return data;
}

async function recordAudit(args:{
  organizationId:string;
  requestId:string;
  principalType:'owner-admin'|'hercules-internal'|'api-key';
  action:'task_preflight'|'grant_status'|'execute'|'execution_status'|'usage_status';
  provider?:string|null;
  accountKey?:string|null;
  disposition:string;
  decisionSha256:string;
  authorizationEvidenceSha256?:string|null;
  requiredCapabilities?:string[];
  missingCapabilities?:string[];
  reasonCodes?:string[];
}){
  const {error}=await admin.rpc('hercules_domain_agent_record_audit',{
    p_organization_id:args.organizationId,
    p_request_id:args.requestId,
    p_principal_type:args.principalType,
    p_action:args.action,
    p_provider:args.provider??null,
    p_account_key:args.accountKey??null,
    p_disposition:args.disposition,
    p_decision_sha256:args.decisionSha256,
    p_authorization_evidence_sha256:args.authorizationEvidenceSha256??null,
    p_required_capabilities:args.requiredCapabilities??[],
    p_missing_capabilities:args.missingCapabilities??[],
    p_reason_codes:args.reasonCodes??[]
  });
  if(error)throw new Error('authorization_audit_failed:'+error.message);
}

async function decisionHash(value:unknown){return sha256(JSON.stringify(value))}

async function invokeInternal(service:string,purpose:string,body:Record<string,unknown>){
  const key=await internalServiceKey(purpose);
  const response=await fetch(U+'/functions/v1/'+service,{
    method:'POST',
    headers:{'content-type':'application/json','x-hercules-internal-key':key},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(30000)
  });
  const payload=await response.json().catch(()=>({error:'adapter_invalid_json'}));
  if(!response.ok){
    const error:any=new Error(String(payload?.error||payload?.detail||'provider_adapter_failed'));
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

async function invokeOwnerSession(service:string,authorizationHeader:string,body:Record<string,unknown>){
  const response=await fetch(U+'/functions/v1/'+service,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      authorization:authorizationHeader,
      apikey:A
    },
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(30000)
  });
  const payload=await response.json().catch(()=>({error:'adapter_invalid_json'}));
  if(!response.ok){
    const error:any=new Error(String(payload?.error||payload?.detail||'provider_adapter_failed'));
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

async function dispatchProvider(principal:Principal,body:any,requestId:string){
  const capability=String(body.capability||'').trim().toLowerCase();
  const adapter=PROVIDER_ADAPTERS[capability];
  if(!adapter)throw Object.assign(new Error('execution_adapter_unavailable'),{status:422});

  const accountKey=body.account_key==null?null:String(body.account_key).trim();
  const grant=await resolveGrant(principal.organizationId,{
    provider:adapter.provider,
    account_key:accountKey,
    required_capabilities:[adapter.capability]
  });

  if(!grant?.execution_eligible){
    const error:any=new Error(
      grant?.status==='provider_connection_required'
        ? 'provider_connection_required'
        : 'provider_permission_required'
    );
    error.status=409;
    error.grant=grant;
    throw error;
  }

  const usage=await recordUsage(principal,requestId,{
    kind:'provider_adapter',
    provider:adapter.provider,
    capability
  });

  let result:any;
  if(adapter.ownerSession){
    if(!principal.authorizationHeader){
      const error:any=new Error('owner_session_required_for_provider_adapter');
      error.status=409;
      error.grant=grant;
      throw error;
    }
    const input=body.input&&typeof body.input==='object'?body.input:{};
    result=await invokeOwnerSession(adapter.service,principal.authorizationHeader,{
      action:adapter.action,
      query:String(input.query||'').trim()
    });
  }else{
    result=await invokeInternal(adapter.service,String(adapter.purpose),{action:adapter.action});
  }
  return {adapter,grant,result,usage};
}

async function enqueueInternal(principal:Principal,body:any,requestId:string){
  const workload=String(body.workload_type||'').trim();
  if(!SAFE_WORKLOADS.has(workload)){
    throw Object.assign(new Error('workload_not_allowed'),{status:422});
  }
  const {data:org,error:orgError}=await admin.from('hercules_organizations')
    .select('owner_user_id').eq('id',principal.organizationId).maybeSingle();
  if(orgError||!org?.owner_user_id)throw new Error('organization_owner_unavailable');

  const row={
    organization_id:principal.organizationId,
    created_by:String(org.owner_user_id),
    workload_type:workload,
    status:'queued',
    sandbox_provider:'supabase-edge',
    execution_class:'edge-safe',
    input:body.input??{},
    policy:{
      network:'deny_by_default',
      filesystem:'ephemeral',
      secrets:'explicit_allowlist',
      timeout_seconds:Math.min(Math.max(Number(body.timeout_seconds||5),1),15)
    },
    idempotency_key:'domain-agent:'+principal.organizationId+':'+requestId,
    capability_envelope:{
      domain_agent:true,
      request_id:requestId,
      principal_type:principal.principalType,
      authorization:'domain_agent_internal'
    },
    trace_id:'domain-agent-'+requestId,
    available_at:new Date().toISOString()
  };
  const {data,error}=await admin.from('hercules_execution_jobs')
    .insert(row)
    .select('id,status,workload_type,execution_class,trace_id,created_at')
    .single();
  let job=data;
  if(error){
    if(String(error.code)!=='23505')throw new Error('execution_enqueue_failed');
    const existing=await admin.from('hercules_execution_jobs')
      .select('id,status,workload_type,execution_class,trace_id,created_at,output,error,completed_at')
      .eq('organization_id',principal.organizationId)
      .eq('idempotency_key',row.idempotency_key)
      .maybeSingle();
    job=existing.data;
  }
  if(!job?.id)throw new Error('execution_job_unavailable');

  for(let i=0;i<3;i++){
    const current=await admin.from('hercules_execution_jobs')
      .select('id,status,workload_type,execution_class,trace_id,created_at,started_at,completed_at,output,error')
      .eq('id',job.id).eq('organization_id',principal.organizationId).maybeSingle();
    if(current.data&&['succeeded','failed','cancelled','dead_letter'].includes(String(current.data.status))){
      return current.data;
    }
    await invokeInternal('hercules-background-runner','background-runner',{action:'tick'});
  }
  const final=await admin.from('hercules_execution_jobs')
    .select('id,status,workload_type,execution_class,trace_id,created_at,started_at,completed_at,output,error')
    .eq('id',job.id).eq('organization_id',principal.organizationId).maybeSingle();
  return final.data||job;
}

async function executionStatus(organizationId:string,jobId:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)){
    throw Object.assign(new Error('valid_job_id_required'),{status:400});
  }
  const {data,error}=await admin.from('hercules_execution_jobs')
    .select('id,status,workload_type,execution_class,trace_id,created_at,started_at,completed_at,output,error')
    .eq('id',jobId).eq('organization_id',organizationId).maybeSingle();
  if(error||!data)throw Object.assign(new Error('execution_not_found'),{status:404});
  return data;
}

export function isDomainAgentAction(action:string){return ACTIONS.has(action)}

export function isDomainAgentGet(req:Request,url=new URL(req.url)){
  if(req.method!=='GET')return false;
  const q=String(url.searchParams.get('domain_agent')||'').toLowerCase();
  return q==='discovery'||q==='health'
    || url.pathname.endsWith('/.well-known/hercules-agent.json')
    || url.pathname.endsWith('/hercules-private-bridge/health');
}

export async function handleDomainAgentRequest(req:Request){
  try{
    const url=new URL(req.url);
    if(req.method==='GET'){
      const q=String(url.searchParams.get('domain_agent')||'').toLowerCase();
      if(q==='discovery'||url.pathname.endsWith('/.well-known/hercules-agent.json'))return out(discovery());
      return out({
        ok:true,
        service:'hercules-domain-agent',
        version:'2.0.0-multiplex',
        schema:'hercules.domain-agent.health.v1',
        intendedOrigin:ORIGIN,
        backendService:'hercules-private-bridge',
        backendLive:true,
        customDomainVerified:false,
        executionAdapters:true,
        providerNativeRefresh:true,
        executionAuthority:false
      });
    }

    if(req.method!=='POST')return out({error:'method_not_allowed'},405);
    const body:any=await readJson(req);
    if(hasSensitiveInput(body))return out({error:'raw_credentials_not_accepted'},400);
    const action=String(body.action||'');
    if(!ACTIONS.has(action))return out({error:'unknown_domain_agent_action'},400);

    if(action==='domain_agent_api_key_issue'||action==='domain_agent_api_key_revoke'){
      return out(await manageApiKey(req,body,action));
    }

    const requiredScope=action==='domain_agent_execute'?'domain-agent:execute':'domain-agent:read';
    const principal=await resolveOrganization(req,body,requiredScope);
    const requestId=String(body.request_id||crypto.randomUUID()).trim().slice(0,128);
    if(!requestId)return out({error:'request_id_required'},400);

    if(action==='domain_agent_usage_status'){
      const usage=await usageStatus(principal.organizationId);
      const response={ok:true,service:'hercules-domain-agent',request_id:requestId,usage};
      const digest=await decisionHash(response);
      await recordAudit({
        organizationId:principal.organizationId,requestId,principalType:principal.principalType,
        action:'usage_status',disposition:'READ',decisionSha256:digest,reasonCodes:['USAGE_STATUS_READ']
      });
      return out({...response,decision_sha256:digest});
    }

    if(action==='domain_agent_identity_status'){
      const identities=await identityStatus(principal.organizationId);
      return out({
        ok:true,
        service:'hercules-domain-agent',
        request_id:requestId,
        identities
      });
    }

    if(action==='domain_agent_execution_status'){
      const job=await executionStatus(principal.organizationId,String(body.job_id||''));
      const response={ok:true,service:'hercules-domain-agent',request_id:requestId,job};
      const digest=await decisionHash(response);
      await recordAudit({
        organizationId:principal.organizationId,requestId,principalType:principal.principalType,
        action:'execution_status',disposition:String(job.status).toUpperCase(),decisionSha256:digest,
        reasonCodes:['EXECUTION_STATUS_READ']
      });
      return out({...response,decision_sha256:digest});
    }

    if(action==='domain_agent_task_preflight'&&body.owner_boundary!=null){
      const boundary=String(body.owner_boundary);
      if(!OWNER_ONLY.has(boundary))return out({error:'invalid_owner_boundary'},400);
      const response={
        schema:'hercules.domain-agent.preflight.v1',
        disposition:'OWNER_ACTION_REQUIRED',
        status:'owner_action_required',
        organization_id:principal.organizationId,
        request_id:requestId,
        owner_boundary:boundary,
        execution_eligible:false,
        execution_authority:false,
        reason_codes:['OWNER_ONLY_BOUNDARY']
      };
      const decisionSha256=await decisionHash(response);
      await recordAudit({
        organizationId:principal.organizationId,requestId,principalType:principal.principalType,
        action:'task_preflight',
        provider:body.provider==null?null:String(body.provider).trim().toLowerCase(),
        accountKey:body.account_key==null?null:String(body.account_key).trim(),
        disposition:'OWNER_ACTION_REQUIRED',decisionSha256,
        requiredCapabilities:strings(body.required_capabilities,'required_capabilities'),
        reasonCodes:['OWNER_ONLY_BOUNDARY']
      });
      return out({...response,decision_sha256:decisionSha256},409);
    }

    if(action==='domain_agent_execute'){
      const ent=await entitlement(principal.organizationId);
      if(ent?.enabled!==true){
        return out({
          error:'domain_agent_entitlement_required',
          plan_code:ent?.plan_code??null,
          reason:ent?.reason??'subscription_required'
        },402);
      }

      if(body.workload_type){
        const usage=await recordUsage(principal,requestId,{kind:'internal_workload',workload_type:String(body.workload_type)});
        const job=await enqueueInternal(principal,body,requestId);
        const response={
          schema:'hercules.domain-agent.execution.v1',
          ok:true,
          organization_id:principal.organizationId,
          request_id:requestId,
          adapter:'hercules-worker-runtime',
          provider:'hercules_internal',
          execution_performed:true,
          job,
          usage,
          carries_credentials:false
        };
        const digest=await decisionHash(response);
        await recordAudit({
          organizationId:principal.organizationId,requestId,principalType:principal.principalType,
          action:'execute',provider:'hercules_internal',accountKey:null,
          disposition:String(job.status).toUpperCase(),decisionSha256:digest,
          requiredCapabilities:['domain_agent_internal'],reasonCodes:['AUTHORIZED_INTERNAL_EXECUTION']
        });
        return out({...response,decision_sha256:digest},String(job.status)==='succeeded'?200:202);
      }

      const capability=String(body.capability||'').trim().toLowerCase();
      const adapter=PROVIDER_ADAPTERS[capability];
      if(!adapter)return out({error:'execution_adapter_unavailable'},422);
      let dispatched:any;
      try{
        dispatched=await dispatchProvider(principal,body,requestId);
      }catch(error){
        const e:any=error;
        if(Number(e?.status)===409){
          const response={
            schema:'hercules.domain-agent.execution.v1',
            ok:false,
            organization_id:principal.organizationId,
            request_id:requestId,
            provider:adapter.provider,
            capability,
            status:'owner_action_required',
            disposition:'OWNER_ACTION_REQUIRED',
            execution_performed:false,
            owner_action_required:true,
            grant:e.grant??null,
            reason_codes:[String(e.message||'PROVIDER_AUTHORIZATION_REQUIRED').toUpperCase()]
          };
          const digest=await decisionHash(response);
          await recordAudit({
            organizationId:principal.organizationId,requestId,principalType:principal.principalType,
            action:'execute',provider:adapter.provider,accountKey:body.account_key??null,
            disposition:'OWNER_ACTION_REQUIRED',decisionSha256:digest,
            authorizationEvidenceSha256:e.grant?.authorization_evidence_sha256??null,
            requiredCapabilities:[capability],
            missingCapabilities:e.grant?.missing_capabilities??[],
            reasonCodes:response.reason_codes
          });
          return out({...response,decision_sha256:digest},409);
        }
        throw error;
      }

      const usage=dispatched.usage;
      const response={
        schema:'hercules.domain-agent.execution.v1',
        ok:true,
        organization_id:principal.organizationId,
        request_id:requestId,
        provider:adapter.provider,
        capability,
        adapter_service:adapter.service,
        provider_native_refresh:true,
        refresh_mode:dispatched.grant?.refresh_mode??'none',
        authorization_evidence_sha256:dispatched.grant?.authorization_evidence_sha256??null,
        execution_performed:true,
        result:dispatched.result,
        usage,
        carries_credentials:false
      };
      const digest=await decisionHash(response);
      await recordAudit({
        organizationId:principal.organizationId,requestId,principalType:principal.principalType,
        action:'execute',provider:adapter.provider,accountKey:dispatched.grant?.account_key??null,
        disposition:'SUCCEEDED',decisionSha256:digest,
        authorizationEvidenceSha256:dispatched.grant?.authorization_evidence_sha256??null,
        requiredCapabilities:[capability],reasonCodes:['AUTHORIZED_PROVIDER_EXECUTION']
      });
      return out({...response,decision_sha256:digest});
    }

    const grant=await resolveGrant(principal.organizationId,body);

    if(action==='domain_agent_grant_status'){
      const response={
        ok:true,
        service:'hercules-domain-agent',
        organization_id:principal.organizationId,
        request_id:requestId,
        grant
      };
      const decisionSha256=await decisionHash(response);
      await recordAudit({
        organizationId:principal.organizationId,requestId,principalType:principal.principalType,
        action:'grant_status',
        provider:grant?.provider??null,accountKey:grant?.account_key??null,
        disposition:String(grant?.status||'unresolved'),decisionSha256,
        authorizationEvidenceSha256:grant?.authorization_evidence_sha256??null,
        requiredCapabilities:grant?.required_capabilities??[],
        missingCapabilities:grant?.missing_capabilities??[],
        reasonCodes:grant?.reason_codes??['AUTHORIZATION_UNRESOLVED']
      });
      return out({...response,decision_sha256:decisionSha256});
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
      request_id:requestId,
      provider:grant?.provider??null,
      account_key:grant?.account_key??null,
      connection_ref:grant?.connection_ref??null,
      authorization_evidence_sha256:grant?.authorization_evidence_sha256??null,
      capabilities:grant?.capabilities??[],
      required_capabilities:grant?.required_capabilities??[],
      missing_capabilities:grant?.missing_capabilities??[],
      refreshable:Boolean(grant?.refreshable),
      refresh_mode:grant?.refresh_mode??'none',
      provider_native_refresh:Boolean(grant?.refreshable),
      execution_eligible:eligible,
      execution_authority:false,
      owner_action_required:ownerRequired,
      credential_custody:'supabase_vault',
      carries_credentials:false,
      reason_codes:grant?.reason_codes??['AUTHORIZATION_UNRESOLVED']
    };
    const decisionSha256=await decisionHash(response);
    await recordAudit({
      organizationId:principal.organizationId,requestId,principalType:principal.principalType,
      action:'task_preflight',
      provider:grant?.provider??null,accountKey:grant?.account_key??null,
      disposition,decisionSha256,
      authorizationEvidenceSha256:grant?.authorization_evidence_sha256??null,
      requiredCapabilities:grant?.required_capabilities??[],
      missingCapabilities:grant?.missing_capabilities??[],
      reasonCodes:grant?.reason_codes??['AUTHORIZATION_UNRESOLVED']
    });
    return out({...response,decision_sha256:decisionSha256},eligible?200:ownerRequired?409:403);
  }catch(error){
    const status=Number((error as any)?.status)||500;
    const name=error instanceof Error?error.message:String(error);
    return out({error:status>=500?'internal_error':name},status);
  }
}
