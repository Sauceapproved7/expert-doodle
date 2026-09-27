import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=Deno.env.get('SUPABASE_ANON_KEY')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(U,S,{auth:{persistSession:false}});
const enc=new TextEncoder();

const out=(body:unknown,status=200)=>Response.json(body,{status,headers:{
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization,content-type,x-hercules-personal-session',
  'access-control-allow-methods':'GET,POST,OPTIONS'
}});

async function sha256Hex(value:string){
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))]
    .map(x=>x.toString(16).padStart(2,'0')).join('');
}

function randomToken(){
  return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
}

function validOrigin(value:string){
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&u.origin===value&&!u.username&&!u.password;
  }catch{return false}
}

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
    .eq('session_token_sha256',hash)
    .eq('status','connected')
    .gt('expires_at',new Date().toISOString())
    .maybeSingle();
  return data||null;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return out({ok:true});
  if(req.method==='GET')return out({ok:true,service:'hercules-personal-browser-bridge',version:'1.0.0'});
  if(req.method!=='POST')return out({error:'method_not_allowed'},405);

  const body=await req.json().catch(()=>({}));
  const action=String(body.action||'');

  if(hasCredentialMaterial(body) && !['connect'].includes(action)){
    return out({error:'credential_export_forbidden'},400);
  }

  if(action==='create_pair'){
    const user=await owner(req);
    if(!user)return out({error:'owner_auth_required'},401);
    const pairToken=randomToken();
    const pairHash=await sha256Hex(pairToken);
    const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
    const {data,error}=await admin.from('hercules_personal_browser_sessions').insert({
      owner_user_id:user.id,
      pair_token_sha256:pairHash,
      status:'waiting',
      expires_at:expiresAt
    }).select('id,expires_at').single();
    if(error)return out({error:'pair_create_failed',detail:error.message},500);
    return out({ok:true,session_id:data.id,pair_token:pairToken,expires_at:data.expires_at});
  }

  if(action==='owner_status'){
    const user=await owner(req);
    if(!user)return out({error:'owner_auth_required'},401);
    const {data,error}=await admin.from('hercules_personal_browser_sessions')
      .select('id,status,approved_origin,approved_tab_title,browser_name,connected_at,last_seen_at,expires_at,created_at')
      .eq('owner_user_id',user.id)
      .order('created_at',{ascending:false})
      .limit(10);
    if(error)return out({error:'status_failed',detail:error.message},500);
    return out({ok:true,sessions:data||[]});
  }

  if(action==='owner_close'){
    const user=await owner(req);
    if(!user)return out({error:'owner_auth_required'},401);
    const id=String(body.session_id||'');
    const {error}=await admin.from('hercules_personal_browser_sessions')
      .update({status:'closed',updated_at:new Date().toISOString()})
      .eq('id',id).eq('owner_user_id',user.id);
    if(error)return out({error:'close_failed',detail:error.message},500);
    return out({ok:true});
  }

  if(action==='connect'){
    const pairToken=String(body.pair_token||'');
    const approvedOrigin=String(body.approved_origin||'');
    if(!pairToken||!validOrigin(approvedOrigin))return out({error:'invalid_pair_request'},400);
    const pairHash=await sha256Hex(pairToken);
    const {data:row}=await admin.from('hercules_personal_browser_sessions')
      .select('id,status,expires_at')
      .eq('pair_token_sha256',pairHash)
      .eq('status','waiting')
      .gt('expires_at',new Date().toISOString())
      .maybeSingle();
    if(!row)return out({error:'pair_token_invalid_or_expired'},403);

    const sessionToken=randomToken();
    const sessionHash=await sha256Hex(sessionToken);
    const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
    const {error}=await admin.from('hercules_personal_browser_sessions').update({
      session_token_sha256:sessionHash,
      approved_origin:approvedOrigin,
      approved_tab_title:String(body.approved_tab_title||'').slice(0,240),
      browser_name:String(body.browser_name||'Hercules Personal Browser').slice(0,120),
      status:'connected',
      connected_at:new Date().toISOString(),
      last_seen_at:new Date().toISOString(),
      expires_at:expiresAt,
      updated_at:new Date().toISOString()
    }).eq('id',row.id).eq('status','waiting');
    if(error)return out({error:'pair_connect_failed',detail:error.message},500);
    return out({ok:true,session_id:row.id,session_token:sessionToken,expires_at:expiresAt});
  }

  const token=req.headers.get('x-hercules-personal-session')||'';
  const session=await sessionFromToken(token);
  if(!session)return out({error:'personal_browser_session_required'},401);

  if(action==='disconnect'){
    await admin.from('hercules_personal_browser_sessions').update({
      status:'closed',last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',session.id);
    return out({ok:true});
  }

  if(action==='poll'){
    await admin.from('hercules_personal_browser_sessions').update({
      last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',session.id);

    const {data:cmd,error}=await admin.from('hercules_personal_browser_commands')
      .select('id,action,payload,created_at')
      .eq('session_id',session.id)
      .eq('status','pending')
      .order('created_at',{ascending:true})
      .limit(1)
      .maybeSingle();
    if(error)return out({error:'command_poll_failed',detail:error.message},500);
    if(!cmd)return out({ok:true,command:null});

    const {data:claimed,error:claimError}=await admin.from('hercules_personal_browser_commands')
      .update({status:'claimed',claimed_at:new Date().toISOString()})
      .eq('id',cmd.id).eq('status','pending')
      .select('id,action,payload,created_at').maybeSingle();
    if(claimError)return out({error:'command_claim_failed',detail:claimError.message},500);
    return out({ok:true,command:claimed||null});
  }

  if(action==='complete'){
    const commandId=String(body.command_id||'');
    const result=body.result&&typeof body.result==='object'?body.result:{ok:false,error:'invalid_result'};
    if(hasCredentialMaterial(result))return out({error:'credential_export_forbidden'},400);
    const ok=(result as Record<string,unknown>).ok===true;
    const {error}=await admin.from('hercules_personal_browser_commands').update({
      status:ok?'succeeded':'failed',
      result,
      error:ok?null:String((result as Record<string,unknown>).error||'browser_action_failed').slice(0,500),
      completed_at:new Date().toISOString()
    }).eq('id',commandId).eq('session_id',session.id).eq('status','claimed');
    if(error)return out({error:'command_complete_failed',detail:error.message},500);
    return out({ok:true});
  }

  return out({error:'unknown_action'},400);
});
