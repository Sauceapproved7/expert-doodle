import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||'';
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const admin=createClient(U,S,{auth:{persistSession:false}});
const enc=new TextEncoder();
const ACTIONS=new Set(['personal_browser_create_pair','personal_browser_owner_status','personal_browser_owner_close','personal_browser_connect','personal_browser_poll','personal_browser_complete','personal_browser_disconnect']);

const out=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
async function sha256Hex(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function randomToken(){return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')}
function validOrigin(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value&&!u.username&&!u.password}catch{return false}}
function hasCredentialMaterial(value:unknown):boolean{
  if(Array.isArray(value))return value.some(hasCredentialMaterial);
  if(!value||typeof value!=='object')return false;
  for(const [k,v] of Object.entries(value as Record<string,unknown>)){
    if(/password|passwd|cookie|authorization|provider.?token|session.?cookie|one.?time.?code|otp|mfa.?secret|recovery.?code|private.?key/i.test(k))return true;
    if(hasCredentialMaterial(v))return true;
  }
  return false;
}
async function owner(req:Request){
  const h=req.headers.get('authorization')||'';
  if(!h.startsWith('Bearer '))return null;
  const db=createClient(U,A,{auth:{persistSession:false},global:{headers:{Authorization:h}}});
  const {data:{user}}=await db.auth.getUser();
  return user||null;
}
async function sessionFromToken(token:string){
  if(!token)return null;
  const hash=await sha256Hex(token);
  const {data}=await admin.from('hercules_personal_browser_sessions')
    .select('id,owner_user_id,status,approved_origin,expires_at')
    .eq('session_token_sha256',hash).eq('status','connected')
    .gt('expires_at',new Date().toISOString()).maybeSingle();
  return data||null;
}
export function isPersonalBrowserAction(action:string){return ACTIONS.has(action)}

export async function handlePersonalBrowserRequest(req:Request){
  const body=await req.clone().json().catch(()=>({}));
  const action=String(body.action||'');

  if(hasCredentialMaterial(body)&&action!=='personal_browser_connect')return out({error:'credential_export_forbidden'},400);

  if(action==='personal_browser_create_pair'){
    const user=await owner(req); if(!user)return out({error:'owner_auth_required'},401);
    const pairToken=randomToken(), pairHash=await sha256Hex(pairToken);
    const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
    const {data,error}=await admin.from('hercules_personal_browser_sessions').insert({
      owner_user_id:user.id,pair_token_sha256:pairHash,status:'waiting',expires_at:expiresAt
    }).select('id,expires_at').single();
    if(error)return out({error:'pair_create_failed',detail:error.message},500);
    return out({ok:true,session_id:data.id,pair_token:pairToken,expires_at:data.expires_at});
  }

  if(action==='personal_browser_owner_status'){
    const user=await owner(req); if(!user)return out({error:'owner_auth_required'},401);
    const {data,error}=await admin.from('hercules_personal_browser_sessions')
      .select('id,status,approved_origin,approved_tab_title,browser_name,connected_at,last_seen_at,expires_at,created_at')
      .eq('owner_user_id',user.id).order('created_at',{ascending:false}).limit(10);
    if(error)return out({error:'status_failed',detail:error.message},500);
    return out({ok:true,sessions:data||[]});
  }

  if(action==='personal_browser_owner_close'){
    const user=await owner(req); if(!user)return out({error:'owner_auth_required'},401);
    const {error}=await admin.from('hercules_personal_browser_sessions').update({status:'closed',updated_at:new Date().toISOString()})
      .eq('id',String(body.session_id||'')).eq('owner_user_id',user.id);
    return error?out({error:'close_failed',detail:error.message},500):out({ok:true});
  }

  if(action==='personal_browser_connect'){
    const pairToken=String(body.pair_token||''), approvedOrigin=String(body.approved_origin||'');
    if(!pairToken||!validOrigin(approvedOrigin))return out({error:'invalid_pair_request'},400);
    const pairHash=await sha256Hex(pairToken);
    const {data:row}=await admin.from('hercules_personal_browser_sessions').select('id')
      .eq('pair_token_sha256',pairHash).eq('status','waiting').gt('expires_at',new Date().toISOString()).maybeSingle();
    if(!row)return out({error:'pair_token_invalid_or_expired'},403);
    const sessionToken=randomToken(), sessionHash=await sha256Hex(sessionToken);
    const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
    const {error}=await admin.from('hercules_personal_browser_sessions').update({
      session_token_sha256:sessionHash,approved_origin:approvedOrigin,
      approved_tab_title:String(body.approved_tab_title||'').slice(0,240),
      browser_name:String(body.browser_name||'Hercules Personal Browser').slice(0,120),
      status:'connected',connected_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),
      expires_at:expiresAt,updated_at:new Date().toISOString()
    }).eq('id',row.id).eq('status','waiting');
    if(error)return out({error:'pair_connect_failed',detail:error.message},500);
    return out({ok:true,session_id:row.id,session_token:sessionToken,expires_at:expiresAt});
  }

  const token=req.headers.get('x-hercules-personal-session')||'';
  const session=await sessionFromToken(token);
  if(!session)return out({error:'personal_browser_session_required'},401);

  if(action==='personal_browser_disconnect'){
    await admin.from('hercules_personal_browser_sessions').update({status:'closed',last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',session.id);
    return out({ok:true});
  }

  if(action==='personal_browser_poll'){
    await admin.from('hercules_personal_browser_sessions').update({last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',session.id);
    const {data:cmd,error}=await admin.from('hercules_personal_browser_commands').select('id,action,payload,created_at')
      .eq('session_id',session.id).eq('status','pending').order('created_at',{ascending:true}).limit(1).maybeSingle();
    if(error)return out({error:'command_poll_failed',detail:error.message},500);
    if(!cmd)return out({ok:true,command:null});
    const {data:claimed,error:claimError}=await admin.from('hercules_personal_browser_commands')
      .update({status:'claimed',claimed_at:new Date().toISOString()}).eq('id',cmd.id).eq('status','pending')
      .select('id,action,payload,created_at').maybeSingle();
    return claimError?out({error:'command_claim_failed',detail:claimError.message},500):out({ok:true,command:claimed||null});
  }

  if(action==='personal_browser_complete'){
    const result=body.result&&typeof body.result==='object'?body.result:{ok:false,error:'invalid_result'};
    if(hasCredentialMaterial(result))return out({error:'credential_export_forbidden'},400);
    const ok=(result as Record<string,unknown>).ok===true;
    const {error}=await admin.from('hercules_personal_browser_commands').update({
      status:ok?'succeeded':'failed',result,error:ok?null:String((result as Record<string,unknown>).error||'browser_action_failed').slice(0,500),
      completed_at:new Date().toISOString()
    }).eq('id',String(body.command_id||'')).eq('session_id',session.id).eq('status','claimed');
    return error?out({error:'command_complete_failed',detail:error.message},500):out({ok:true});
  }

  return out({error:'unknown_personal_browser_action'},400);
}
