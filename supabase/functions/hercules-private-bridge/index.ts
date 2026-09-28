import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleSpaceshipDnsRequest } from './spaceship-dns-control.ts';
import { handleSpaceshipMcpRequest, isSpaceshipMcpAction } from './spaceship-mcp.ts';
import { handlePersonalBrowserRequest, isPersonalBrowserAction } from './personal-browser.ts';
import { handleDomainAgentRequest, isDomainAgentAction, isDomainAgentGet } from './domain-agent.ts';
import { handlePilotAdmissionRequest, isPilotAdmissionAction } from './pilot-admission.ts';

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
const LAUNCH_PACKET={
  version:'hercules-launch-packet-2026-09-27-v2',
  digest:'e2166a626887f9c5995f409d6ce91900ef2175bcc6e221b6bffec46ce657a086',
  documents:{
    pricing:{path:LAUNCH_DOCS.pricing,sha:'85ecbdc37e4d73cdf1b6c3f9987fac8a57c47f00'},
    terms:{path:LAUNCH_DOCS.terms,sha:'e607d7e992458b9a7f0cca82cdeb216cae47eab5'},
    privacy:{path:LAUNCH_DOCS.privacy,sha:'5bb5022e464c68ba27e80a1a2bfaa430c624cc44'}
  },
  pricing:{
    starter:{monthly:4900,annual:49000},
    pro:{monthly:14900,annual:149000},
    scale:{monthly:39900,annual:399000}
  }
} as const;
const LAUNCH_PACKET_CONFIRMATION='APPROVE HERCULES LAUNCH PACKET '+LAUNCH_PACKET.digest.slice(0,12).toUpperCase();

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
  const [{data:approvals,error:approvalError},{data:gate,error:gateError},{data:release,error:releaseError},{data:passwordDefense,error:passwordDefenseError}]=await Promise.all([
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
      .maybeSingle(),
    admin.rpc('hercules_password_defense_status')
  ]);
  if(approvalError||gateError||releaseError||passwordDefenseError)throw new Error('launch_approval_status_failed');

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
      mode:'system_computed',
      control:'hercules-password-defense-v2',
      verified:passwordDefense?.ok===true,
      evidence:passwordDefense||null,
      note:'Launch auth hardening is computed from live Hercules password-defense evidence. The native Supabase warning may remain documented without becoming the launch decision source.'
    }
  };
}

async function launchApprovalEnvelopeStatus(){
  const status=await launchApprovalStatus();
  const [{data:passwordDefense,error:passwordDefenseError},{data:plans,error}]=await Promise.all([
    admin.rpc('hercules_password_defense_status'),
    admin.from('hercules_plans')
      .select('code,monthly_price_cents,annual_price_cents,is_active')
      .in('code',['starter','pro','scale'])
      .order('code')
  ]);
  if(error)throw new Error('launch_packet_pricing_read_failed');
  if(passwordDefenseError)throw new Error('launch_packet_auth_hardening_read_failed');

  const byCode=Object.fromEntries((plans||[]).map((row:any)=>[row.code,row]));
  const pricingCatalogMatches=(['starter','pro','scale'] as const).every(code=>{
    const expected=LAUNCH_PACKET.pricing[code], live=byCode[code];
    return Boolean(
      live?.is_active===true &&
      Number(live?.monthly_price_cents)===expected.monthly &&
      Number(live?.annual_price_cents)===expected.annual
    );
  });
  const authHardeningApproved=passwordDefense?.ok===true;
  const packetApprovals=['pricing','terms','privacy'].map(type=>({
    type,
    status:status?.approvals?.[type]?.status||'pending',
    document:(LAUNCH_PACKET.documents as any)[type]
  }));

  return {
    ok:true,
    packet:{
      version:LAUNCH_PACKET.version,
      digest:LAUNCH_PACKET.digest,
      fingerprint:LAUNCH_PACKET.digest.slice(0,12).toUpperCase(),
      confirmation:LAUNCH_PACKET_CONFIRMATION,
      documents:LAUNCH_PACKET.documents,
      pricing:LAUNCH_PACKET.pricing
    },
    readiness:{
      authHardeningApproved,
      authHardeningSource:'hercules-password-defense-v2',
      authHardeningEvidence:passwordDefense||null,
      pricingCatalogMatches,
      publicRegistrationHeldClosed:status.publicRegistrationOpen!==true,
      canApprove:authHardeningApproved&&pricingCatalogMatches&&status.publicRegistrationOpen!==true
    },
    approvals:packetApprovals,
    gate:status.gate||null,
    publicRegistrationOpen:status.publicRegistrationOpen
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


const SPACESHIP_CREDENTIAL_DROP_PURPOSE='spaceship-dns-credential-drop-v1';
const CREDENTIAL_HTML_HEADERS=new Headers({
  'content-type':'text/html; charset=UTF-8',
  'cache-control':'no-store, no-cache, must-revalidate',
  'pragma':'no-cache',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'referrer-policy':'no-referrer',
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
});
async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function credentialDropPage(token:string,opts:{error?:string;success?:string}={}){
  const safe=/^[0-9a-f]{64}$/.test(token)?token:'';
  const message=opts.success
    ? '<div class="msg ok">'+opts.success+'</div>'
    : opts.error
      ? '<div class="msg err">'+opts.error+'</div>'
      : '<div class="msg">Create a fresh Spaceship API key with <code>dnsrecords:read</code> and <code>dnsrecords:write</code>. Hercules validates the pair against Spaceship before anything is stored.</div><p><a href="https://www.spaceship.com/application/api-manager/" rel="noreferrer">Open Spaceship API Manager</a></p>';
  const form=(opts.success||!safe)?'':(
    '<form method="post" action="?spaceship_credentials=1&handoff_token='+safe+'" autocomplete="off">'+
    '<label>Spaceship API Key<input name="api_key" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="512"></label>'+
    '<label>Spaceship API Secret<input name="api_secret" type="password" autocomplete="new-password" required maxlength="1024"></label>'+
    '<button type="submit">Securely save + continue launch</button>'+
    '</form>'+
    '<p class="fine">Required permissions: <code>dnsrecords:read</code> and <code>dnsrecords:write</code>. This handoff expires and can be used once.</p>'
  );
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Hercules · Spaceship DNS</title><style>'+
    ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090909;color:#f5f5f5;font-family:system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:560px;margin:0 auto;padding:28px 18px}.brand{font-weight:900;letter-spacing:.14em}.card{margin-top:18px;background:#151515;border:1px solid #333;border-radius:18px;padding:20px}h1{font-size:24px;margin:8px 0}p{color:#bbb;line-height:1.5}.msg{background:#0d0d0d;border:1px solid #333;border-radius:12px;padding:12px;margin:14px 0}.ok{border-color:#2f6f44;color:#c9f7d6}.err{border-color:#7c3535;color:#ffd0d0}label{display:block;margin:14px 0;color:#ddd;font-weight:700}input{display:block;width:100%;margin-top:7px;background:#080808;color:#fff;border:1px solid #444;border-radius:11px;padding:13px;font-size:16px}button{width:100%;border:0;border-radius:11px;padding:13px 16px;font-size:16px;font-weight:850;background:#fff;color:#080808}.fine{font-size:13px}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}'+
    '</style></head><body><main class="wrap"><div class="brand">HERCULES</div><div class="card"><h1>Spaceship DNS secure setup</h1><p>For <strong>sauceapproved.com</strong></p>'+
    message+form+'</div></main></body></html>';
  return new Response(html,{status:opts.error?400:200,headers:CREDENTIAL_HTML_HEADERS});
}
async function findCredentialDrop(token:string){
  if(!/^[0-9a-f]{64}$/.test(token))return null;
  const hash=await sha256Hex(token);
  const now=new Date().toISOString();
  const {data,error}=await admin.from('hercules_spaceship_auth_handoffs')
    .select('id,status,expires_at,metadata')
    .eq('token_sha256',hash)
    .in('status',['issued','launched'])
    .gt('expires_at',now)
    .contains('metadata',{purpose:SPACESHIP_CREDENTIAL_DROP_PURPOSE})
    .maybeSingle();
  if(error||!data)return null;
  return data;
}

async function validateSpaceshipExternalPair(apiKey:string,apiSecret:string){
  const endpoint='https://spaceship.dev/api/v1/dns/records/sauceapproved.com?take=1&skip=0&orderBy=type';
  async function probe(key:string,secret:string){
    try{
      const response=await fetch(endpoint,{
        method:'GET',
        headers:{'X-API-Key':key,'X-API-Secret':secret},
        signal:AbortSignal.timeout(15000)
      });
      return response.status;
    }catch{
      return 0;
    }
  }
  const normal=await probe(apiKey,apiSecret);
  if(normal===200)return {ok:true,apiKey,apiSecret,normalized:false};
  if(normal===403)return {ok:false,reason:'scope'};
  if(normal!==401&&normal!==0)return {ok:false,reason:'provider'};

  const swapped=await probe(apiSecret,apiKey);
  if(swapped===200)return {ok:true,apiKey:apiSecret,apiSecret:apiKey,normalized:true};
  if(swapped===403)return {ok:false,reason:'scope'};
  if(swapped===401)return {ok:false,reason:'credentials'};
  return {ok:false,reason:'provider'};
}

async function handleSpaceshipCredentialDrop(req:Request,requestUrl:URL){
  const token=String(requestUrl.searchParams.get('handoff_token')||'').trim().toLowerCase();
  const row=await findCredentialDrop(token);
  if(!row)return credentialDropPage('',{error:'This secure handoff is invalid, expired, or already used.'});
  const now=new Date().toISOString();

  if(req.method==='GET'){
    const patch:any={status:'launched',last_opened_at:now,updated_at:now};
    if(row.status==='issued')patch.launched_at=now;
    await admin.from('hercules_spaceship_auth_handoffs').update(patch).eq('id',row.id).in('status',['issued','launched']);
    return credentialDropPage(token);
  }

  if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:CREDENTIAL_HTML_HEADERS});
  const form=await req.formData().catch(()=>null);
  let apiKey=String(form?.get('api_key')||'').trim();
  let apiSecret=String(form?.get('api_secret')||'').trim();
  if(!apiKey||!apiSecret||apiKey.length>512||apiSecret.length>1024){
    apiKey=''; apiSecret='';
    return credentialDropPage(token,{error:'Both the Spaceship API key and one-time secret are required.'});
  }

  const {data:claimed,error:claimError}=await admin.from('hercules_spaceship_auth_handoffs').update({
    status:'starting',last_opened_at:now,updated_at:now
  }).eq('id',row.id).in('status',['issued','launched']).select('id').maybeSingle();
  if(claimError||!claimed){
    apiKey=''; apiSecret='';
    return credentialDropPage('',{error:'This secure handoff was already used or expired.'});
  }

  const validated=await validateSpaceshipExternalPair(apiKey,apiSecret);
  if(!validated.ok){
    apiKey=''; apiSecret='';
    await admin.from('hercules_spaceship_auth_handoffs').update({status:'launched',updated_at:new Date().toISOString()}).eq('id',row.id).eq('status','starting');
    const message=validated.reason==='scope'
      ? 'Spaceship accepted the credential pair, but the key is missing dnsrecords:read and/or dnsrecords:write.'
      : validated.reason==='credentials'
        ? 'Spaceship rejected this API key and secret. Create a fresh API key in Spaceship API Manager and try again.'
        : 'Spaceship credential validation is temporarily unavailable. Retry this handoff without creating another key.';
    return credentialDropPage(token,{error:message});
  }

  apiKey=validated.apiKey;
  apiSecret=validated.apiSecret;
  const {data:configured,error:configureError}=await admin.rpc('hercules_spaceship_dns_configure_credentials',{
    p_api_key:apiKey,p_api_secret:apiSecret
  });
  apiKey=''; apiSecret='';
  if(configureError||configured!==true){
    await admin.from('hercules_spaceship_auth_handoffs').update({status:'launched',updated_at:new Date().toISOString()}).eq('id',row.id).eq('status','starting');
    return credentialDropPage(token,{error:'Hercules could not store the validated credentials. You can retry this handoff.'});
  }

  const [domainTick,emailTick]=await Promise.all([
    admin.rpc('hercules_domain_launch_autopilot_tick'),
    admin.rpc('hercules_business_email_dns_autopilot_tick')
  ]);
  await admin.from('hercules_spaceship_auth_handoffs').update({
    status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    metadata:{...(row.metadata||{}),secret_exposure:false,credentials_stored:true,autopilot_started:true}
  }).eq('id',row.id).eq('status','starting');

  const domainStarted=!domainTick.error;
  const emailStarted=!emailTick.error;
  return credentialDropPage('',{success:
    'Credentials secured in Hercules Vault. Domain launch automation '+(domainStarted?'started':'will retry automatically')+
    '; business-email DNS automation '+(emailStarted?'started.':'will retry automatically.')
  });
}

Deno.serve(async(req:Request)=>{
  const requestUrl=new URL(req.url);
  if(isDomainAgentGet(req,requestUrl))return handleDomainAgentRequest(req);
  if(requestUrl.searchParams.get('spaceship_credentials')==='1'){
    return handleSpaceshipCredentialDrop(req,requestUrl);
  }
  if(req.method==='GET' && requestUrl.searchParams.get('spaceship_authorize')==='1'){
    return handleSpaceshipMcpRequest(req);
  }
  if(req.method==='GET' && requestUrl.searchParams.get('spaceship_mcp_oauth_callback')==='1'){
    return handleSpaceshipMcpRequest(req);
  }
  if(req.method==='POST'){
    const probe=await req.clone().json().catch(()=>({}));
    const probeAction=String(probe?.action||'');
    if(isDomainAgentAction(probeAction))return handleDomainAgentRequest(req);
    if(isPilotAdmissionAction(probeAction))return handlePilotAdmissionRequest(req);
    if(isSpaceshipMcpAction(probeAction))return handleSpaceshipMcpRequest(req);
    if(isPersonalBrowserAction(probeAction))return handlePersonalBrowserRequest(req);
  }
  if(req.method==='POST' && req.headers.get('x-hercules-internal-key')){
    return handleSpaceshipDnsRequest(req);
  }
  if(req.method==='GET'){
    const {count}=await admin.from('hercules_private_bridge_profiles').select('id',{count:'exact',head:true});
    return out({ok:true,service:'hercules-private-bridge',version:'1.6.0',status:'ready',
      capabilities:['profile_registry','private_dns','route_policy','reconnect_policy','health_state','launch_approval_status','launch_owner_decision','launch_approval_bundle','privacy_request_list','privacy_request_verify','privacy_request_preview','privacy_export','privacy_deletion_plan','privacy_delete_user_content','domain_agent_authorization','domain_agent_preflight','domain_agent_discovery','domain_agent_execute','domain_agent_usage','domain_agent_api','pilot_admission_control'],
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

  if(action==='launch_approval_bundle_status'){
    try{return out(await launchApprovalEnvelopeStatus())}
    catch{return out({error:'launch_approval_bundle_status_failed'},500)}
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
        error:'auth_hardening_is_system_computed',
        required:'The launch gate verifies Hercules Password Defense v2 directly. This is not an owner self-approval.'
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

  if(action==='launch_approval_bundle_decide'){
    if(String(a.m.role)!=='owner')return out({error:'owner_required'},403);
    const packetVersion=String(b.packet_version||'').trim();
    const packetDigest=String(b.packet_digest||'').trim().toLowerCase();
    const confirmation=String(b.confirmation||'').trim().toUpperCase();

    if(packetVersion!==LAUNCH_PACKET.version)return out({
      error:'launch_packet_version_mismatch',
      expected:LAUNCH_PACKET.version
    },409);
    if(packetDigest!==LAUNCH_PACKET.digest)return out({
      error:'launch_packet_digest_mismatch',
      expected:LAUNCH_PACKET.digest
    },409);
    if(confirmation!==LAUNCH_PACKET_CONFIRMATION)return out({
      error:'explicit_confirmation_required',
      expected:LAUNCH_PACKET_CONFIRMATION
    },400);

    const envelope=await launchApprovalEnvelopeStatus();
    if(!envelope.readiness.authHardeningApproved)return out({
      error:'auth_hardening_required_before_launch_packet'
    },409);
    if(!envelope.readiness.pricingCatalogMatches)return out({
      error:'launch_packet_pricing_catalog_mismatch'
    },409);
    if(!envelope.readiness.publicRegistrationHeldClosed)return out({
      error:'public_registration_must_be_held_closed_during_launch_packet_approval'
    },409);

    const documentShas={
      pricing:LAUNCH_PACKET.documents.pricing.sha,
      terms:LAUNCH_PACKET.documents.terms.sha,
      privacy:LAUNCH_PACKET.documents.privacy.sha
    };
    const {data,error}=await admin.rpc('hercules_launch_approval_bundle_decide',{
      p_user_id:uid,
      p_organization_id:org,
      p_packet_version:LAUNCH_PACKET.version,
      p_packet_digest:LAUNCH_PACKET.digest,
      p_document_shas:documentShas,
      p_confirmation:LAUNCH_PACKET_CONFIRMATION
    });
    if(error)return out({error:'launch_approval_bundle_update_failed',detail:error.message},500);

    const gateRefresh=await refreshLaunchGate();
    return out({
      ok:true,
      packet:data,
      gateRefresh,
      status:await launchApprovalStatus(),
      envelope:await launchApprovalEnvelopeStatus()
    });
  }

  if(action==='privacy_request_list'){
    const limit=Math.max(1,Math.min(100,Number(b.limit||25)));
    const status=String(b.status||'').trim();
    let q=admin.from('hercules_privacy_requests')
      .select('public_reference,category,email,message,status,requester_verified,verification_method,created_at,updated_at,resolved_at')
      .order('created_at',{ascending:false})
      .limit(limit);
    if(status)q=q.eq('status',status);
    const {data,error}=await q;
    if(error)return out({error:'privacy_request_list_failed'},500);
    return out({ok:true,requests:data||[]});
  }

  if(action==='privacy_request_verify'){
    if(String(a.m.role)!=='owner')return out({error:'owner_required'},403);
    const reference=String(b.reference||'').trim().toLowerCase();
    const method=String(b.verification_method||'').trim();
    const confirmation=String(b.confirmation||'').trim().toUpperCase();
    const allowedMethods=new Set(['authenticated_account','email_control','business_authority']);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference))return out({error:'valid_reference_required'},400);
    if(!allowedMethods.has(method))return out({error:'valid_verification_method_required'},400);
    const expected=('VERIFY '+reference).toUpperCase();
    if(confirmation!==expected)return out({error:'explicit_confirmation_required',expected},400);

    const {data:current,error:readError}=await admin.from('hercules_privacy_requests')
      .select('public_reference,status,requester_verified,metadata')
      .eq('public_reference',reference)
      .maybeSingle();
    if(readError||!current)return out({error:'privacy_request_not_found'},404);

    const now=new Date().toISOString();
    const metadata={
      ...(current.metadata||{}),
      verification:{
        verified_by:uid,
        verified_at:now,
        method
      }
    };
    const {data,error}=await admin.from('hercules_privacy_requests')
      .update({
        requester_verified:true,
        verification_method:method,
        status:'verifying',
        metadata,
        updated_at:now
      })
      .eq('public_reference',reference)
      .select('public_reference,category,email,status,requester_verified,verification_method,updated_at')
      .maybeSingle();
    if(error||!data)return out({error:'privacy_request_verification_failed'},500);

    await admin.from('hercules_audit_log').insert({
      organization_id:org,
      actor_user_id:uid,
      action:'privacy.request.verified',
      resource_type:'hercules_privacy_request',
      resource_id:reference,
      changes:{requester_verified:true,verification_method:method,status:'verifying'},
      metadata:{source:'hercules-private-bridge',explicit_confirmation:true}
    });
    return out({ok:true,request:data});
  }

  if(action==='privacy_request_preview'){
    const reference=String(b.reference||'').trim().toLowerCase();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference))return out({error:'valid_reference_required'},400);
    const {data,error}=await admin.rpc('hercules_privacy_request_preview',{p_public_reference:reference});
    if(error)return out({error:'privacy_request_preview_failed',detail:error.message},500);
    return out(data||{ok:false,error:'privacy_request_preview_empty'},data?.ok===false?409:200);
  }

  if(action==='privacy_export'){
    const reference=String(b.reference||'').trim().toLowerCase();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference))return out({error:'valid_reference_required'},400);
    const {data,error}=await admin.rpc('hercules_privacy_request_export',{p_public_reference:reference});
    if(error)return out({error:'privacy_export_failed',detail:error.message},500);
    if(data?.ok===false)return out(data,409);
    const now=new Date().toISOString();
    await admin.from('hercules_privacy_requests')
      .update({status:'in_progress',updated_at:now})
      .eq('public_reference',reference);
    await admin.from('hercules_audit_log').insert({
      organization_id:org,
      actor_user_id:uid,
      action:'privacy.request.export.generated',
      resource_type:'hercules_privacy_request',
      resource_id:reference,
      changes:{schema_version:data?.schema_version||null,size_bytes:data?.size_bytes||null},
      metadata:{source:'hercules-private-bridge-v1.5.0',secret_exposure:false}
    });
    return out(data);
  }

  if(action==='privacy_deletion_plan'){
    const reference=String(b.reference||'').trim().toLowerCase();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference))return out({error:'valid_reference_required'},400);
    const {data,error}=await admin.rpc('hercules_privacy_request_deletion_plan',{p_public_reference:reference});
    if(error)return out({error:'privacy_deletion_plan_failed',detail:error.message},500);
    return out(data||{ok:false,error:'privacy_deletion_plan_empty'},data?.ok===false?409:200);
  }

  if(action==='privacy_delete_user_content'){
    if(String(a.m.role)!=='owner')return out({error:'owner_required'},403);
    const reference=String(b.reference||'').trim().toLowerCase();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference))return out({error:'valid_reference_required'},400);
    const confirmation=String(b.confirmation||'').trim().toUpperCase();
    const expected='DELETE '+reference.toUpperCase();
    if(confirmation!==expected)return out({error:'explicit_confirmation_required',expected},400);
    const {data,error}=await admin.rpc('hercules_privacy_request_delete_user_content',{
      p_public_reference:reference,
      p_confirmation:confirmation
    });
    if(error)return out({error:'privacy_delete_user_content_failed',detail:error.message},500);
    if(data?.ok===false)return out(data,409);
    await admin.from('hercules_audit_log').insert({
      organization_id:org,
      actor_user_id:uid,
      action:'privacy.request.user_content_deleted',
      resource_type:'hercules_privacy_request',
      resource_id:reference,
      changes:{
        deleted:data?.deleted||{},
        full_account_deletion_complete:false,
        preserved_for_review:data?.preserved_for_review||[]
      },
      metadata:{source:'hercules-private-bridge-v1.5.0',explicit_confirmation:true,secret_exposure:false}
    });
    return out(data);
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