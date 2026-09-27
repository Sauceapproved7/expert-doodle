import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleSpaceshipDnsRequest } from './spaceship-dns-control.ts';
import { handleSpaceshipMcpRequest, isSpaceshipMcpAction } from './spaceship-mcp.ts';
import { handlePersonalBrowserRequest, isPersonalBrowserAction } from './personal-browser.ts';

const U=Deno.env.get('SUPABASE_URL')!;
const A=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||'';
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=createClient(U,S,{auth:{persistSession:false}});
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const LAUNCH_APPROVALS=['pricing','terms','privacy','auth_hardening'] as const;
const LAUNCH_DOCS={
  pricing:'docs/launch/HERCULES-PRICING-PROPOSAL.md',
  terms:'docs/launch/HERCULES-TERMS-OF-SERVICE-DRAFT.md',
  privacy:'docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md',
  auth_hardening:'docs/launch/HERCULES-AUTH-SECURITY-REVIEW-2026-09-27.md'
} as const;

async function actor(req:Request){
  const h=req.headers.get('authorization')||'', token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token)return null;
  const db=createClient(U,A,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+token}}});
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user)return null;
  const {data:m}=await db.from('hercules_memberships').select('organization_id,role,status')
    .eq('user_id',data.user.id).eq('status','active').in('role',['owner','admin']).limit(1).maybeSingle();
  return m?{user:data.user,m}:null;
}

function validServerUrl(raw:string){
  try{
    const u=new URL(raw);
    const h=u.hostname.toLowerCase();
    if(u.protocol!=='https:')return false;
    if(h==='localhost'||h.endsWith('.local')||h==='0.0.0.0'||h==='127.0.0.1'||h==='::1')return false;
    if(/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h))return false;
    const m=/^172\.(\d+)\./.exec(h); if(m&&Number(m[1])>=16&&Number(m[1])<=31)return false;
    return true;
  }catch{return false}
}
function cleanDns(v:unknown){
  if(!Array.isArray(v))return [];
  return [...new Set(v.map(x=>String(x).trim()).filter(x=>x&&x.length<=253))].slice(0,8);
}
function cleanRoutes(v:unknown){
  if(!Array.isArray(v))return [];
  return v.map(x=>String(x).trim()).filter(x=>/^[0-9a-f:.]+\/\d+$/i.test(x)).slice(0,32);
}
function reconnect(v:any){
  const max=Math.max(1,Math.min(50,Number(v?.max_attempts||10)));
  const delay=Math.max(1,Math.min(300,Number(v?.base_delay_seconds||5)));
  return {enabled:v?.enabled!==false,max_attempts:max,base_delay_seconds:delay};
}
async function audit(org:string,uid:string,action:string,id:string|null,changes:any){
  await admin.from('hercules_audit_log').insert({
    organization_id:org,actor_user_id:uid,action,resource_type:'hercules_private_bridge_profile',
    resource_id:id,changes,metadata:{operator_mode:'conversation_only',manual_operator_steps:false}
  });
}

async function launchApprovalStatus(){
  const [{data:approvals,error:approvalError},{data:gate,error:gateError},{data:release,error:releaseError}]=await Promise.all([
    admin.from('hercules_launch_approvals')
      .select('approval_type,status,approved_at,evidence,updated_at')
      .order('approval_type'),
    admin.from('hercules_launch_gate_checks')
      .select('technical_ok,commercial_ok,launch_ready,checks,checked_at')
      .order('checked_at',{ascending:false})
      .limit(1)
      .maybeSingle(),
    admin.from('hercules_continuity_ledger')
      .select('status,value,verified_at')
      .eq('key','public-registration-open')
      .maybeSingle()
  ]);
  if(approvalError||gateError||releaseError)throw new Error('launch_approval_status_failed');

  const byType=Object.fromEntries((approvals||[]).map((row:any)=>[
    row.approval_type,
    {
      status:row.status,
      approvedAt:row.approved_at||null,
      evidence:row.evidence||{},
      updatedAt:row.updated_at||null,
      document:(LAUNCH_DOCS as any)[row.approval_type]||null
    }
  ]));

  return {
    ok:true,
    approvals:byType,
    required:[...LAUNCH_APPROVALS],
    gate:gate||null,
    publicRegistrationOpen:Boolean(release?.status==='active'&&release?.value?.open===true),
    publicRegistrationVerifiedAt:release?.verified_at||null,
    authHardening:{
      selfApprovalAllowed:false,
      blocker:'Supabase leaked-password protection must be enabled and independently verified before auth_hardening can be approved.'
    }
  };
}

async function refreshLaunchGate(){
  try{
    const {data:keyRow}=await admin.from('hercules_internal_service_keys')
      .select('secret_ref,enabled')
      .eq('purpose','agent-coordinator')
      .eq('enabled',true)
      .limit(1)
      .maybeSingle();
    if(!keyRow?.secret_ref)return {ok:false,error:'launch_gate_internal_key_missing'};
    const {data:key,error:keyError}=await admin.rpc('hercules_get_secret',{p_id:keyRow.secret_ref});
    if(keyError||!key)return {ok:false,error:'launch_gate_internal_key_unavailable'};
    const response=await fetch(U+'/functions/v1/hercules-launch-gate',{
      method:'POST',
      headers:{'content-type':'application/json','x-hercules-internal-key':String(key)},
      body:'{}',
      signal:AbortSignal.timeout(20000)
    });
    const body=await response.json().catch(()=>({}));
    return {
      ok:response.ok,
      status:response.status,
      launchReady:Boolean(body?.check?.launch_ready),
      commercialOk:Boolean(body?.check?.commercial_ok),
      technicalOk:Boolean(body?.check?.technical_ok),
      checkedAt:body?.check?.checked_at||null
    };
  }catch{
    return {ok:false,error:'launch_gate_refresh_failed'};
  }
}

Deno.serve(async(req:Request)=>{
  const requestUrl=new URL(req.url);
  if(req.method==='GET' && requestUrl.searchParams.get('spaceship_authorize')==='1'){
    return handleSpaceshipMcpRequest(req);
  }
  if(req.method==='GET' && requestUrl.searchParams.get('spaceship_mcp_oauth_callback')==='1'){
    return handleSpaceshipMcpRequest(req);
  }
  if(req.method==='POST'){
    const probe=await req.clone().json().catch(()=>({}));
    const probeAction=String(probe?.action||'');
    if(isSpaceshipMcpAction(probeAction))return handleSpaceshipMcpRequest(req);
    if(isPersonalBrowserAction(probeAction))return handlePersonalBrowserRequest(req);
  }
  if(req.method==='POST' && req.headers.get('x-hercules-internal-key')){
    return handleSpaceshipDnsRequest(req);
  }
  if(req.method==='GET'){
    const {count}=await admin.from('hercules_private_bridge_profiles').select('id',{count:'exact',head:true});
    return out({ok:true,service:'hercules-private-bridge',version:'1.2.0',status:'ready',
      capabilities:['profile_registry','private_dns','route_policy','reconnect_policy','health_state','launch_approval_status','launch_owner_decision'],
      configuredProfiles:count||0,nativeAndroidClient:'future_phase',operatorInteraction:'conversation_only',
      manualOperatorSteps:false,checkedAt:new Date().toISOString()});
  }
  if(req.method!=='POST')return out({error:'method_not_allowed'},405);
  const a=await actor(req); if(!a)return out({error:'owner_or_admin_required'},403);
  const org=String(a.m.organization_id), uid=String(a.user.id);
  const b=await req.json().catch(()=>({})), action=String(b.action||'status');

  if(action==='launch_approval_status'){
    try{return out(await launchApprovalStatus())}
    catch{return out({error:'launch_approval_status_failed'},500)}
  }

  if(action==='launch_approval_decide'){
    if(String(a.m.role)!=='owner')return out({error:'owner_required'},403);
    const approvalType=String(b.approval_type||'').trim();
    const decision=String(b.decision||'').trim();
    const confirmation=String(b.confirmation||'').trim().toUpperCase();
    if(!LAUNCH_APPROVALS.includes(approvalType as any))return out({error:'valid_approval_type_required'},400);
    if(!['approved','rejected','pending'].includes(decision))return out({error:'valid_decision_required'},400);
    if(approvalType==='auth_hardening'&&decision==='approved'){
      return out({
        error:'auth_hardening_requires_verified_platform_evidence',
        required:'Enable Supabase leaked-password protection, rerun the production security advisor, and require the warning to clear before approval.'
      },409);
    }
    const expected=(decision==='approved'?'APPROVE ':decision==='rejected'?'REJECT ':'RESET ')+approvalType.replace('_',' ').toUpperCase();
    if(confirmation!==expected)return out({error:'explicit_confirmation_required',expected},400);

    const now=new Date().toISOString();
    const evidence={
      source:'hercules-launch-owner-decision-center-v1',
      document:(LAUNCH_DOCS as any)[approvalType],
      confirmationVerified:true,
      decision,
      decidedAt:now
    };
    const patch=decision==='approved'
      ? {status:'approved',approved_by:uid,approved_at:now,evidence,updated_at:now}
      : decision==='rejected'
        ? {status:'rejected',approved_by:uid,approved_at:now,evidence,updated_at:now}
        : {status:'pending',approved_by:null,approved_at:null,evidence,updated_at:now};

    const {data,error}=await admin.from('hercules_launch_approvals')
      .update(patch)
      .eq('approval_type',approvalType)
      .select('approval_type,status,approved_at,evidence,updated_at')
      .maybeSingle();
    if(error||!data)return out({error:'launch_approval_update_failed'},500);

    await admin.from('hercules_audit_log').insert({
      organization_id:org,
      actor_user_id:uid,
      action:'launch.approval.'+decision,
      resource_type:'hercules_launch_approval',
      resource_id:approvalType,
      changes:{approval_type:approvalType,status:decision,document:(LAUNCH_DOCS as any)[approvalType]},
      metadata:{source:'hercules-launch-owner-decision-center-v1',explicit_confirmation:true}
    });

    const gateRefresh=await refreshLaunchGate();
    return out({ok:true,approval:data,gateRefresh,status:await launchApprovalStatus()});
  }

  if(action==='spaceship_dns_status'){
    const {data,error}=await admin.from('hercules_spaceship_dns_credentials')
      .select('status,configured_at,updated_at')
      .eq('singleton',true).maybeSingle();
    if(error)return out({error:'spaceship_dns_status_failed'},500);
    return out({
      ok:true,
      provider:'spaceship',
      domain:'sauceapproved.com',
      status:data?.status||'unconfigured',
      configuredAt:data?.configured_at||null,
      updatedAt:data?.updated_at||null,
      permissions:['dnsrecords:read','dnsrecords:write'],
      secretExposure:false
    });
  }

  if(action==='configure_spaceship_dns'){
    const apiKey=String(b.api_key||'').trim();
    const apiSecret=String(b.api_secret||'').trim();
    if(!apiKey||!apiSecret)return out({error:'spaceship_api_key_and_secret_required'},400);
    const {data,error}=await admin.rpc('hercules_spaceship_dns_configure_credentials',{
      p_api_key:apiKey,
      p_api_secret:apiSecret
    });
    b.api_key=''; b.api_secret='';
    if(error||data!==true)return out({error:'spaceship_dns_configuration_failed'},500);
    await admin.from('hercules_audit_log').insert({
      organization_id:org,
      actor_user_id:uid,
      action:'spaceship.dns.credentials.configured',
      resource_type:'hercules_spaceship_dns',
      resource_id:null,
      changes:{domain:'sauceapproved.com',status:'configured'},
      metadata:{secret_exposure:false,permissions:['dnsrecords:read','dnsrecords:write']}
    });
    return out({
      ok:true,
      provider:'spaceship',
      domain:'sauceapproved.com',
      status:'configured',
      permissions:['dnsrecords:read','dnsrecords:write'],
      secretExposure:false
    });
  }

  if(action==='status'||action==='list'){
    const {data,error}=await admin.from('hercules_private_bridge_profiles')
      .select('id,name,server_url,private_dns,routes,reconnect_policy,enabled,connection_status,last_health_at,last_health,created_at,updated_at')
      .eq('organization_id',org).order('updated_at',{ascending:false});
    if(error)return out({error:'profile_read_failed'},500);
    return out({ok:true,profiles:data||[],count:data?.length||0,backendReady:true,nativeAndroidClient:'future_phase'});
  }

  if(action==='upsert_profile'){
    const name=String(b.name||'').trim(), serverUrl=String(b.server_url||'').trim();
    if(!name||name.length>80)return out({error:'valid_name_required'},400);
    if(!validServerUrl(serverUrl))return out({error:'public_https_server_url_required'},400);
    const row={organization_id:org,name,server_url:serverUrl,private_dns:cleanDns(b.private_dns),
      routes:cleanRoutes(b.routes),reconnect_policy:reconnect(b.reconnect_policy),enabled:b.enabled!==false,
      connection_status:b.enabled===false?'disabled':'configured',created_by:uid,updated_at:new Date().toISOString()};
    const {data,error}=await admin.from('hercules_private_bridge_profiles').upsert(row,{onConflict:'organization_id,name'})
      .select('id,name,server_url,private_dns,routes,reconnect_policy,enabled,connection_status,updated_at').single();
    if(error)return out({error:'profile_write_failed',detail:error.message},500);
    await audit(org,uid,'private_bridge.profile.upserted',data.id,{name:data.name,server_url:data.server_url});
    return out({ok:true,profile:data,next:'attach_owned_private_server_then_native_android_client'},201);
  }

  if(action==='set_state'){
    const id=String(b.id||''), state=String(b.connection_status||'');
    if(!['configured','connecting','connected','degraded','disconnected','disabled'].includes(state))
      return out({error:'valid_connection_status_required'},400);
    const {data,error}=await admin.from('hercules_private_bridge_profiles').update({
      connection_status:state,last_health_at:new Date().toISOString(),
      last_health:{source:'operator_control_plane',state,recorded_at:new Date().toISOString()},
      enabled:state!=='disabled',updated_at:new Date().toISOString()
    }).eq('organization_id',org).eq('id',id)
      .select('id,name,connection_status,last_health_at,last_health').maybeSingle();
    if(error||!data)return out({error:'profile_not_found'},404);
    await audit(org,uid,'private_bridge.state.updated',data.id,{connection_status:state});
    return out({ok:true,profile:data});
  }

  if(action==='disable_profile'){
    const id=String(b.id||'');
    const {data,error}=await admin.from('hercules_private_bridge_profiles').update({
      enabled:false,connection_status:'disabled',updated_at:new Date().toISOString()
    }).eq('organization_id',org).eq('id',id).select('id,name,enabled,connection_status').maybeSingle();
    if(error||!data)return out({error:'profile_not_found'},404);
    await audit(org,uid,'private_bridge.profile.disabled',data.id,{enabled:false});
    return out({ok:true,profile:data});
  }
  return out({error:'unknown_action'},400);
});