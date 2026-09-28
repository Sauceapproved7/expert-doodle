const PILOT_ADMISSION_PURPOSE='pilot-admission-control';
export const PILOT_ADMISSION_OWNER_ERROR='owner_required';
export const PILOT_ADMISSION_INTERNAL_ERROR='internal_authorization_required';
const PILOT_ADMISSION_VERSION='hercules-founding-pilot-admission-v1';
const PILOT_QUALIFICATION_VERSION='pilot-qualification-v1';
const PILOT_SCOPE='controlled-us-b2b-receivables';
const HANDOFF_TTL_MS=30*60*1000;

async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function randomToken(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function publicRegistrationOpen(admin:any){
  const {data,error}=await admin.from('hercules_continuity_ledger')
    .select('status,value,verified_at')
    .eq('key','public-registration-open')
    .maybeSingle();
  if(error)throw new Error('public_registration_state_unavailable');
  return {
    open:Boolean(data?.status==='active'&&data?.value?.open===true),
    verifiedAt:data?.verified_at||null
  };
}
async function serviceKeyRow(admin:any){
  const {data,error}=await admin.from('hercules_internal_service_keys')
    .select('purpose,key_sha256,enabled,secret_ref,rotated_at')
    .eq('purpose',PILOT_ADMISSION_PURPOSE)
    .eq('enabled',true)
    .limit(1)
    .maybeSingle();
  if(error||!data?.secret_ref||!data?.key_sha256)throw new Error('pilot_admission_service_key_unavailable');
  return data;
}
async function assertVaultBackedServiceKey(admin:any){
  const row=await serviceKeyRow(admin);
  const {data,error}=await admin.rpc('hercules_get_secret',{p_id:row.secret_ref});
  let secret=String(data||'');
  if(error||!secret)throw new Error('pilot_admission_service_key_unavailable');
  const ok=safeEqual(await sha256Hex(secret),String(row.key_sha256));
  secret='';
  if(!ok)throw new Error('pilot_admission_service_key_integrity_failed');
  return {purpose:row.purpose,rotatedAt:row.rotated_at||null,vaultBacked:true};
}
export async function pilotAdmissionInternalAuthorized(req:Request,admin:any){
  const supplied=req.headers.get('x-hercules-internal-key')||'';
  if(!supplied)return false;
  const row=await serviceKeyRow(admin).catch(()=>null);
  if(!row?.secret_ref)return false;
  const digest=await sha256Hex(supplied);
  return safeEqual(String(row.key_sha256),digest);
}
function qualified(metadata:any,syntheticCertification:boolean){
  if(metadata?.qualification_version!==PILOT_QUALIFICATION_VERSION)return false;
  if(metadata?.scope!==PILOT_SCOPE)return false;
  if(metadata?.manages_own_receivables!==true)return false;
  if(metadata?.excluded_use_ack!==true)return false;
  if(metadata?.approval_gated_ack!==true)return false;
  const mode=String(metadata?.data_mode||'');
  if(syntheticCertification)return mode==='synthetic';
  return mode==='authorized_real';
}
function exampleEmail(email:string){return /@example\.com$/i.test(email)}
function validUuid(value:string){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export async function pilotAdmissionControlStatus(admin:any){
  const [registration,key]=await Promise.all([
    publicRegistrationOpen(admin),
    serviceKeyRow(admin).then(x=>({configured:true,purpose:x.purpose,vaultBacked:Boolean(x.secret_ref),rotatedAt:x.rotated_at||null})).catch(()=>({configured:false,purpose:PILOT_ADMISSION_PURPOSE,vaultBacked:false,rotatedAt:null}))
  ]);
  return {
    ok:true,
    admissionVersion:PILOT_ADMISSION_VERSION,
    qualificationVersion:PILOT_QUALIFICATION_VERSION,
    protectedContactsOnly:true,
    publicRegistrationOpen:registration.open,
    publicRegistrationVerifiedAt:registration.verifiedAt,
    serviceKey:key,
    paidBillingActivated:false
  };
}
export async function issuePilotAdmission(admin:any,body:any,options:{
  principal:'owner'|'hercules-internal';
  actorUserId?:string|null;
  syntheticOnly?:boolean;
  launchBaseUrl:string;
}){
  const registration=await publicRegistrationOpen(admin);
  if(registration.open)return {status:409,body:{ok:false,error:'public_registration_must_remain_closed'}};

  const key=await assertVaultBackedServiceKey(admin);
  const contactId=String(body?.contact_id||'').trim().toLowerCase();
  if(!validUuid(contactId))return {status:400,body:{ok:false,error:'protected_contact_id_required'}};

  const syntheticCertification=body?.synthetic_certification===true;
  if(options.syntheticOnly===true&&!syntheticCertification){
    return {status:403,body:{ok:false,error:'synthetic_only'}};
  }

  const {data:contact,error}=await admin.from('marketing_contacts')
    .select('id,email,status,metadata,updated_at')
    .eq('id',contactId)
    .maybeSingle();
  if(error||!contact)return {status:404,body:{ok:false,error:'qualified_contact_not_found'}};

  const email=String(contact.email||'').trim().toLowerCase();
  if(contact.status==='opted_out')return {status:409,body:{ok:false,error:'contact_opted_out'}};
  if(!qualified(contact.metadata||{},syntheticCertification)){
    return {status:409,body:{ok:false,error:'pilot_qualification_required'}};
  }
  if(syntheticCertification&&!exampleEmail(email)){
    return {status:409,body:{ok:false,error:'synthetic_only'}};
  }
  if(!syntheticCertification&&exampleEmail(email)){
    return {status:409,body:{ok:false,error:'real_pilot_contact_required'}};
  }

  const prior=contact.metadata?.pilot_admission||{};
  if(['issued','redeeming','accepted'].includes(String(prior.status||''))){
    return {status:409,body:{ok:false,error:'pilot_admission_already_active',admissionStatus:prior.status}};
  }

  const token=randomToken();
  const tokenSha256=await sha256Hex(token);
  const now=new Date();
  const expiresAt=new Date(now.getTime()+HANDOFF_TTL_MS).toISOString();
  const metadata={
    ...(contact.metadata||{}),
    pilot_admission:{
      version:PILOT_ADMISSION_VERSION,
      status:'issued',
      token_sha256:tokenSha256,
      issued_at:now.toISOString(),
      expires_at:expiresAt,
      synthetic_certification:syntheticCertification,
      principal:options.principal
    }
  };
  const {data:updated,error:updateError}=await admin.from('marketing_contacts')
    .update({metadata,updated_at:now.toISOString()})
    .eq('id',contact.id)
    .eq('updated_at',contact.updated_at)
    .select('id')
    .maybeSingle();
  if(updateError||!updated)return {status:409,body:{ok:false,error:'pilot_admission_issue_conflict'}};

  await admin.from('marketing_events').insert({
    event_name:'pilot_admission_issued',
    event_source:'hercules-private-bridge',
    url:'/controlled-pilot-admission',
    properties:{
      contact_id:contact.id,
      admission_version:PILOT_ADMISSION_VERSION,
      synthetic_certification:syntheticCertification,
      principal:options.principal,
      public_registration_open:false
    },
    occurred_at:now.toISOString()
  });

  const handoffUrl=options.launchBaseUrl+'?pilot_admission='+encodeURIComponent(token);
  return {
    status:201,
    body:{
      ok:true,
      contactId:contact.id,
      handoffUrl,
      expiresAt,
      admissionVersion:PILOT_ADMISSION_VERSION,
      publicRegistrationOpen:false,
      paidBillingActivated:false,
      serviceKey:{purpose:key.purpose,vaultBacked:key.vaultBacked},
      syntheticCertification
    }
  };
}
