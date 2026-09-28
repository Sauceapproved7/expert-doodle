import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=createClient(U,S,{auth:{persistSession:false,autoRefreshToken:false}});
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const ACTIONS=new Set(['pilot_admission_issue','pilot_admission_status','pilot_admission_revoke']);
const PURPOSE='pilot-admission-control';

export function isPilotAdmissionAction(action:string){
  return ACTIONS.has(String(action||'').trim());
}

function validEmail(value:string){
  return value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function asBool(value:unknown){
  return value===true||value==='true';
}
async function sha256Hex(value:string){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function randomHandoff(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function internalAuthorized(req:Request){
  const supplied=(req.headers.get('x-hercules-internal-key')||'').trim();
  if(supplied.length<32||!S)return false;
  const digest=await sha256Hex(supplied);
  const {data,error}=await admin.from('hercules_internal_service_keys')
    .select('key_sha256,enabled')
    .eq('purpose',PURPOSE)
    .eq('enabled',true)
    .maybeSingle();
  return !error&&Boolean(data?.enabled)&&String(data?.key_sha256||'')===digest;
}
async function qualifiedContact(email:string){
  const {data,error}=await admin.from('marketing_contacts')
    .select('id,email,first_name,status,metadata,organization_id,created_at,updated_at')
    .eq('email',email)
    .limit(1)
    .maybeSingle();
  if(error||!data)return {ok:false as const,error:'qualified_pilot_contact_required',status:404};
  const m=(data.metadata||{}) as Record<string,unknown>;
  if(String(data.status||'')==='unsubscribed')return {ok:false as const,error:'pilot_contact_unsubscribed',status:409};
  if(String(m.qualification_version||'')!=='pilot-qualification-v1'||
     !asBool(m.manages_own_receivables)||
     !asBool(m.excluded_use_ack)||
     !asBool(m.approval_gated_ack)||
     !['synthetic','authorized_real'].includes(String(m.data_mode||''))){
    return {ok:false as const,error:'pilot_qualification_required',status:409};
  }
  return {ok:true as const,contact:data,metadata:m};
}
async function recordEvent(contact:any,eventName:string,properties:Record<string,unknown>){
  await admin.from('marketing_events').insert({
    contact_id:contact.id,
    organization_id:contact.organization_id||null,
    event_name:eventName,
    event_source:'hercules-private-bridge',
    url:'/pilot/admission',
    properties,
    occurred_at:new Date().toISOString()
  });
}
async function issue(email:string,ttlSeconds:number){
  const q=await qualifiedContact(email);
  if(!q.ok)return out({ok:false,error:q.error},q.status);
  const currentStatus=String(q.metadata.pilot_admission_status||'');
  if(['accepted','active'].includes(currentStatus)){
    return out({ok:false,error:'pilot_admission_already_accepted'},409);
  }
  const rawHandoff=randomHandoff();
  const digest=await sha256Hex(rawHandoff);
  const now=new Date();
  const expiresAt=new Date(now.getTime()+ttlSeconds*1000).toISOString();
  const metadata={
    ...q.metadata,
    pilot_admission_status:'issued',
    pilot_admission_token_sha256:digest,
    pilot_admission_expires_at:expiresAt,
    pilot_admission_issued_at:now.toISOString(),
    pilot_admission_issued_by:PURPOSE,
    controlled_pilot_admission:true
  };
  const {data,error}=await admin.from('marketing_contacts')
    .update({metadata,updated_at:now.toISOString()})
    .eq('id',q.contact.id)
    .select('id,email,status,metadata')
    .maybeSingle();
  if(error||!data)return out({ok:false,error:'pilot_admission_issue_failed'},500);
  await recordEvent(q.contact,'pilot_admission_issued',{
    qualification_version:'pilot-qualification-v1',
    data_mode:q.metadata.data_mode,
    expires_at:expiresAt,
    token_stored_as:'sha256'
  });
  return out({
    ok:true,
    status:'issued',
    email,
    expires_at:expiresAt,
    handoff_url:U+'/functions/v1/hercules-launch?pilot_accept='+encodeURIComponent(rawHandoff),
    one_time_handoff:true
  });
}
async function status(email:string){
  const q=await qualifiedContact(email);
  if(!q.ok)return out({ok:false,error:q.error},q.status);
  return out({
    ok:true,
    email,
    status:String(q.metadata.pilot_admission_status||'not_issued'),
    expires_at:q.metadata.pilot_admission_expires_at||null,
    accepted_at:q.metadata.pilot_admission_accepted_at||null,
    organization_id:q.metadata.pilot_admission_organization_id||q.contact.organization_id||null
  });
}
async function revoke(email:string){
  const q=await qualifiedContact(email);
  if(!q.ok)return out({ok:false,error:q.error},q.status);
  const metadata={...q.metadata,pilot_admission_status:'revoked',pilot_admission_revoked_at:new Date().toISOString()};
  delete (metadata as any).pilot_admission_token_sha256;
  const {error}=await admin.from('marketing_contacts').update({metadata,updated_at:new Date().toISOString()}).eq('id',q.contact.id);
  if(error)return out({ok:false,error:'pilot_admission_revoke_failed'},500);
  await recordEvent(q.contact,'pilot_admission_revoked',{reason:'operator_revoke'});
  return out({ok:true,status:'revoked',email});
}

export async function handlePilotAdmissionRequest(req:Request){
  if(req.method!=='POST')return out({ok:false,error:'method_not_allowed'},405);
  if(!await internalAuthorized(req))return out({ok:false,error:'pilot_admission_internal_key_required'},403);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object')return out({ok:false,error:'invalid_json'},400);
  const action=String((body as any).action||'').trim();
  if(!isPilotAdmissionAction(action))return out({ok:false,error:'unsupported_pilot_admission_action'},400);
  const email=String((body as any).email||'').trim().toLowerCase();
  if(!validEmail(email))return out({ok:false,error:'valid_email_required'},400);
  if(action==='pilot_admission_issue'){
    const ttl=Math.max(900,Math.min(86400,Number((body as any).ttl_seconds||86400)));
    return issue(email,ttl);
  }
  if(action==='pilot_admission_status')return status(email);
  return revoke(email);
}
