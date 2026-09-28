import {createClient} from 'npm:@supabase/supabase-js@2';

const PILOT_ADMISSION_VERSION='hercules-founding-pilot-admission-v1';
const PILOT_QUALIFICATION_VERSION='pilot-qualification-v1';
const PILOT_SCOPE='controlled-us-b2b-receivables';
const ACCEPTANCE='HERCULES_FOUNDING_PILOT';
const HEADERS={
  'cache-control':'no-store, no-cache, must-revalidate',
  'pragma':'no-cache',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'referrer-policy':'no-referrer',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://esm.sh; style-src 'unsafe-inline'; connect-src https://*.supabase.co https://esm.sh; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};

async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function tokenFrom(url:URL){
  const token=String(url.searchParams.get('pilot_admission')||'').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(token)?token:'';
}
function qualified(metadata:any){
  return metadata?.qualification_version===PILOT_QUALIFICATION_VERSION
    && metadata?.scope===PILOT_SCOPE
    && metadata?.manages_own_receivables===true
    && metadata?.excluded_use_ack===true
    && metadata?.approval_gated_ack===true
    && ['authorized_real','synthetic'].includes(String(metadata?.data_mode||''));
}
function escapedJson(value:unknown){
  return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
}
function page(inner:string,status=200){
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Hercules Founding Pilot</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090909;color:#f6f6f6;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:620px;margin:0 auto;padding:36px 18px}.brand{font-weight:900;letter-spacing:.14em}.card{margin-top:18px;padding:24px;border:1px solid #343434;border-radius:18px;background:#151515}h1{font-size:26px;margin:.2em 0}.muted{color:#b9b9b9}button{width:100%;padding:14px;border:0;border-radius:11px;font-weight:800;font-size:16px}label{display:flex;gap:10px;align-items:flex-start;margin:18px 0}.err{color:#ffd0d0}</style></head><body><main class="wrap"><div class="brand">HERCULES</div><section class="card">'+inner+'</section></main></body></html>';
  return new Response(html,{status,headers:{...HEADERS,'content-type':'text/html; charset=utf-8'}});
}
async function registrationClosed(admin:any){
  const {data,error}=await admin.from('hercules_continuity_ledger')
    .select('status,value')
    .eq('key','public-registration-open')
    .maybeSingle();
  if(error)throw new Error('public_registration_state_unavailable');
  return !(data?.status==='active'&&data?.value?.open===true);
}
async function contactForToken(admin:any,tokenSha256:string){
  const {data,error}=await admin.from('marketing_contacts')
    .select('id,email,first_name,status,metadata,updated_at')
    .contains('metadata',{pilot_admission:{version:PILOT_ADMISSION_VERSION,token_sha256:tokenSha256,status:'issued'}})
    .limit(1)
    .maybeSingle();
  if(error||!data)return null;
  const admission=data.metadata?.pilot_admission||{};
  if(!qualified(data.metadata||{}))return null;
  if(data.status==='opted_out')return null;
  if(new Date(String(admission.expires_at||0)).getTime()<=Date.now())return null;
  if(admission.synthetic_certification===true&&!/@example\.com$/i.test(String(data.email||'')))return null;
  return data;
}
export async function pilotAdmissionGet(_req:Request,url:URL,ctx:{admin:any}){
  const token=tokenFrom(url);
  if(!token)return page('<h1>Invitation unavailable</h1><p class="muted">This controlled admission handoff is invalid or expired.</p>',404);
  const tokenSha256=await sha256Hex(token);
  const contact=await contactForToken(ctx.admin,tokenSha256);
  if(!contact)return page('<h1>Invitation unavailable</h1><p class="muted">This controlled admission handoff is invalid or expired.</p>',404);
  return page(
    '<h1>Accept Hercules Founding Pilot access</h1>'+
    '<p class="muted">This creates an isolated pilot workspace. Public registration remains closed. No paid billing is activated by this acceptance.</p>'+
    '<form method="post" autocomplete="off">'+
    '<input type="hidden" name="accept" value="'+ACCEPTANCE+'">'+
    '<label><input type="checkbox" name="confirmed" value="yes" required> <span>I am intentionally accepting this controlled Founding Pilot workspace.</span></label>'+
    '<button type="submit">Accept Founding Pilot access</button></form>'
  );
}
async function passwordDefense(admin:any){
  const {data,error}=await admin.rpc('hercules_password_defense_status');
  if(error||!data)return {ok:false,control:'hercules-password-defense-v2'};
  return data;
}
async function founderOrganizationForbidden(admin:any,userId:string){
  const {data:founder,error}=await admin.from('hercules_organizations')
    .select('id,owner_user_id')
    .eq('slug','sauceapproved')
    .maybeSingle();
  if(error)throw new Error('founder_organization_lookup_failed');
  if(!founder)return false;
  if(String(founder.owner_user_id)===userId)return true;
  const {data:membership}=await admin.from('hercules_memberships')
    .select('organization_id,status')
    .eq('organization_id',founder.id)
    .eq('user_id',userId)
    .eq('status','active')
    .maybeSingle();
  return Boolean(membership);
}
async function pilotOrganization(admin:any,contact:any,userId:string){
  if(await founderOrganizationForbidden(admin,userId))throw new Error('founder_organization_forbidden');
  const slug='pilot-'+String(contact.id).replace(/-/g,'').slice(0,20);
  const {data:existing,error:existingError}=await admin.from('hercules_organizations')
    .select('id,slug,owner_user_id,status')
    .eq('slug',slug)
    .maybeSingle();
  if(existingError)throw new Error('pilot_organization_lookup_failed');
  if(existing){
    if(String(existing.owner_user_id)!==userId)throw new Error('pilot_organization_owner_mismatch');
    return existing;
  }
  const company=String(contact.metadata?.company||'').trim().slice(0,100);
  const name=(company?company:'Hercules Founding Pilot')+' — Pilot';
  const {data:org,error}=await admin.from('hercules_organizations')
    .insert({
      name,
      slug,
      owner_user_id:userId,
      metadata:{
        admission:PILOT_ADMISSION_VERSION,
        marketing_contact_id:contact.id,
        public_registration:false,
        paid_billing:false
      }
    })
    .select('id,slug,owner_user_id,status')
    .single();
  if(error||!org)throw new Error('pilot_organization_create_failed');

  const {data:membership,error:membershipError}=await admin.from('hercules_memberships')
    .select('organization_id,user_id,role,status')
    .eq('organization_id',org.id)
    .eq('user_id',userId)
    .eq('role','owner')
    .eq('status','active')
    .maybeSingle();
  if(membershipError||!membership)throw new Error('pilot_organization_provisioning_invariant_failed');
  return org;
}
async function markFailed(admin:any,contact:any,errorCode:string){
  const metadata={
    ...(contact.metadata||{}),
    pilot_admission:{
      ...(contact.metadata?.pilot_admission||{}),
      status:'failed',
      failed_at:new Date().toISOString(),
      error_code:errorCode
    }
  };
  await admin.from('marketing_contacts').update({metadata,updated_at:new Date().toISOString()}).eq('id',contact.id).eq('metadata->pilot_admission->>status','redeeming');
}
function successPage(ctx:{U:string;K:string;session:any;organizationId:string;passwordDefense:any}){
  const publicConfig=escapedJson({url:ctx.U,key:ctx.K});
  const session=escapedJson({access_token:ctx.session.access_token,refresh_token:ctx.session.refresh_token});
  const defense=ctx.passwordDefense?.ok===true;
  const body='<h1>Pilot workspace ready</h1><p class="muted">Your isolated Hercules pilot organization has been provisioned. Public registration remains closed.</p>'+
    '<p class="muted">Password Defense v2: '+(defense?'verified':'not verified')+'. Password sign-in is not enabled by this handoff.</p>'+
    '<p id="state" class="muted">Securing your first session…</p>'+
    '<script type="module">history.replaceState(null,"",location.pathname);import{createClient}from"https://esm.sh/@supabase/supabase-js@2";const cfg='+publicConfig+';const session='+session+';const sb=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});const r=await sb.auth.setSession(session);if(r.error){document.getElementById("state").textContent="Session setup failed. Request a fresh pilot handoff."}else{document.getElementById("state").textContent="Session secured. Opening Hercules…";location.replace(location.pathname)}}</script>';
  return page(body);
}
export async function pilotAdmissionPost(req:Request,url:URL,ctx:{admin:any;U:string;K:string;S:string}){
  const token=tokenFrom(url);
  if(!token)return page('<h1>Invitation unavailable</h1><p class="err">Invalid controlled-admission handoff.</p>',404);
  const form=await req.formData().catch(()=>null);
  if(String(form?.get('accept')||'')!==ACCEPTANCE||String(form?.get('confirmed')||'')!=='yes'){
    return page('<h1>Acceptance required</h1><p class="err">explicit_acceptance_required</p>',400);
  }
  if(!ctx.S||!ctx.K)return page('<h1>Service unavailable</h1><p class="err">server_auth_configuration_required</p>',503);
  if(!await registrationClosed(ctx.admin))return page('<h1>Admission paused</h1><p class="err">public_registration_must_remain_closed</p>',409);

  const tokenSha256=await sha256Hex(token);
  const contact=await contactForToken(ctx.admin,tokenSha256);
  if(!contact)return page('<h1>Invitation unavailable</h1><p class="err">This handoff was already used, expired, or is not qualified.</p>',409);

  const now=new Date().toISOString();
  const claimedMetadata={
    ...(contact.metadata||{}),
    pilot_admission:{...(contact.metadata?.pilot_admission||{}),status:'redeeming',redeeming_at:now}
  };
  const {data:claimed,error:claimError}=await ctx.admin.from('marketing_contacts')
    .update({metadata:claimedMetadata,updated_at:now})
    .eq('id',contact.id)
    .eq('updated_at',contact.updated_at)
    .contains('metadata',{pilot_admission:{token_sha256:tokenSha256,status:'issued'}})
    .select('id,email,status,metadata,updated_at')
    .maybeSingle();
  if(claimError||!claimed)return page('<h1>Invitation unavailable</h1><p class="err">This one-time handoff has already been claimed.</p>',409);

  try{
    const serverAuth=createClient(ctx.U,ctx.S,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
    const email=String(claimed.email||'').trim().toLowerCase();
    const {data:generated,error:generateError}=await serverAuth.auth.admin.generateLink({type:'magiclink',email});
    const hashedToken=String(generated?.properties?.hashed_token||'');
    const user=generated?.user;
    if(generateError||!hashedToken||!user?.id)throw new Error('pilot_magiclink_generation_failed');

    await serverAuth.auth.admin.updateUserById(user.id,{
      app_metadata:{...(user.app_metadata||{}),hercules_pilot:true,pilot_admission_version:PILOT_ADMISSION_VERSION}
    });

    const org=await pilotOrganization(ctx.admin,claimed,user.id);
    const clientAuth=createClient(ctx.U,ctx.K,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
    const {data:verified,error:verifyError}=await clientAuth.auth.verifyOtp({token_hash:hashedToken,type:'email'});
    if(verifyError||!verified?.session)throw new Error('pilot_magiclink_exchange_failed');

    const defense=await passwordDefense(ctx.admin);
    const acceptedAt=new Date().toISOString();
    const acceptedMetadata={
      ...(claimed.metadata||{}),
      pilot_admission:{
        ...(claimed.metadata?.pilot_admission||{}),
        status:'accepted',
        accepted_at:acceptedAt,
        user_id:user.id,
        organization_id:org.id,
        pilot_admission_redeemed:true,
        public_registration_open:false,
        password_defense_control:'hercules-password-defense-v2',
        password_signin_ready:false
      }
    };
    const {error:finalizeError}=await ctx.admin.from('marketing_contacts')
      .update({metadata:acceptedMetadata,organization_id:org.id,updated_at:acceptedAt})
      .eq('id',claimed.id)
      .contains('metadata',{pilot_admission:{token_sha256:tokenSha256,status:'redeeming'}});
    if(finalizeError)throw new Error('pilot_admission_finalize_failed');

    await ctx.admin.from('marketing_events').insert({
      event_name:'pilot_admission_accepted',
      event_source:'hercules-launch',
      url:'/controlled-pilot-admission',
      properties:{
        contact_id:claimed.id,
        organization_id:org.id,
        admission_version:PILOT_ADMISSION_VERSION,
        synthetic_certification:claimed.metadata?.pilot_admission?.synthetic_certification===true,
        public_registration_open:false,
        password_defense_verified:defense?.ok===true
      },
      occurred_at:acceptedAt
    });

    const passwordSignInReady=false;
    void passwordSignInReady;
    return successPage({U:ctx.U,K:ctx.K,session:verified.session,organizationId:org.id,passwordDefense:defense});
  }catch(error){
    const code=error instanceof Error?error.message:'pilot_admission_failed';
    await markFailed(ctx.admin,claimed,code);
    return page('<h1>Pilot setup incomplete</h1><p class="err">'+code.replace(/[^a-z0-9_-]/gi,'_')+'</p><p class="muted">Request a fresh one-time pilot handoff.</p>',409);
  }
}
