import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=Deno.env.get('SUPABASE_ANON_KEY')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PRODUCT='hercules-cleaner';
const SENSITIVE_FIELDS=['file','path','capsule','hostname','serial','mac','username','directory','inventory'];
const ALLOWED_PLATFORMS=new Set(['windows','macos','linux']);

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  }
});

function b64url(bytes:Uint8Array){
  let binary='';
  for(const value of bytes)binary+=String.fromCharCode(value);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

function randomSecret(bytes=32){
  const value=new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return b64url(value);
}

async function sha256(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
}

function assertNoSensitiveFields(value:any){
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
    const lower=key.toLowerCase();
    if(SENSITIVE_FIELDS.some(field=>lower.includes(field)))throw new Error('sensitive_device_metadata_rejected');
    if(child&&typeof child==='object')assertNoSensitiveFields(child);
  }
}

function cleanCode(value:any){
  const code=String(value||'').trim().toUpperCase();
  if(!/^HC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))throw new Error('invalid_activation_code');
  return code;
}

function cleanDevice(body:any){
  if(body.productCode!==PRODUCT)throw new Error('invalid_product_code');
  const deviceId=String(body.deviceId||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId))throw new Error('invalid_device_id');
  const platform=String(body.platform||'');
  if(!ALLOWED_PLATFORMS.has(platform))throw new Error('invalid_platform');
  const version=String(body.version||'');
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('invalid_cleaner_version');
  const publicKeyPem=String(body.publicKeyPem||'');
  if(publicKeyPem.length<80||publicKeyPem.length>1000||!publicKeyPem.includes('BEGIN PUBLIC KEY'))throw new Error('invalid_public_key');
  return {deviceId,platform,version,publicKeyPem};
}

function pemBytes(pem:string){
  const base64=pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g,'');
  const binary=atob(base64);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}

async function verifyEd25519(publicKeyPem:string,challenge:string,signature:string){
  try{
    const key=await crypto.subtle.importKey('spki',pemBytes(publicKeyPem),{name:'Ed25519'},false,['verify']);
    const sig=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));
    return crypto.subtle.verify({name:'Ed25519'},key,sig,new TextEncoder().encode(challenge));
  }catch{return false}
}

async function ownerAuth(req:Request){
  const db=createClient(U,A,{
    global:{headers:{Authorization:req.headers.get('authorization')||''}},
    auth:{persistSession:false}
  });
  const {data:{user}}=await db.auth.getUser();
  if(!user)return null;
  const {data:membership}=await db.from('hercules_memberships')
    .select('organization_id,role')
    .eq('user_id',user.id)
    .eq('status','active')
    .in('role',['owner','admin'])
    .limit(1)
    .maybeSingle();
  return membership?{user,membership}:null;
}

async function bodyJson(req:Request){
  const length=Number(req.headers.get('content-length')||0);
  if(length>16384)throw new Error('request_too_large');
  const body=await req.json();
  assertNoSensitiveFields(body);
  return body;
}

async function issueActivationCode(req:Request,body:any,admin:any){
  const owner=await ownerAuth(req);
  if(!owner)return json({ok:false,error:'owner_auth_required'},401);

  let accessRequestId:null|string=null;
  if(body.accessRequestId){
    accessRequestId=String(body.accessRequestId);
    if(!/^[0-9a-f-]{36}$/i.test(accessRequestId))return json({ok:false,error:'invalid_access_request_id'},400);
    const {data,error}=await admin.from('hercules_software_access_requests')
      .select('id,product_code,status')
      .eq('id',accessRequestId)
      .eq('product_code',PRODUCT)
      .maybeSingle();
    if(error)return json({ok:false,error:'access_request_lookup_failed'},500);
    if(!data)return json({ok:false,error:'cleaner_access_request_required'},409);
  }

  for(let attempt=0;attempt<4;attempt++){
    const raw=randomSecret(6).replace(/[^A-Z0-9]/gi,'').toUpperCase().padEnd(8,'X').slice(0,8);
    const code='HC-'+raw.slice(0,4)+'-'+raw.slice(4,8);
    const codeHash=await sha256(code);
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
    const {error}=await admin.from('hercules_cleaner_activation_codes').insert({
      code_sha256:codeHash,
      product_code:PRODUCT,
      organization_id:owner.membership.organization_id,
      access_request_id:accessRequestId,
      created_by:owner.user.id,
      expires_at:expiresAt
    });
    if(!error)return json({ok:true,activationCode:code,expiresAt,productCode:PRODUCT});
    if(String(error.code)!=='23505')return json({ok:false,error:'activation_code_issue_failed'},500);
  }
  return json({ok:false,error:'activation_code_issue_failed'},500);
}

async function registrationChallenge(body:any,admin:any){
  const device=cleanDevice(body);
  const code=cleanCode(body.activationCode);
  const codeHash=await sha256(code);
  const now=new Date().toISOString();
  const {data:activation,error}=await admin.from('hercules_cleaner_activation_codes')
    .select('id,expires_at,used_at,revoked_at')
    .eq('code_sha256',codeHash)
    .eq('product_code',PRODUCT)
    .maybeSingle();
  if(error)return json({ok:false,error:'activation_lookup_failed'},500);
  if(!activation||activation.used_at||activation.revoked_at||activation.expires_at<=now){
    return json({ok:false,error:'activation_code_unavailable'},409);
  }

  await admin.from('hercules_cleaner_device_challenges')
    .delete()
    .eq('device_id',device.deviceId)
    .is('used_at',null);

  const challenge=randomSecret(32);
  const challengeHash=await sha256(challenge);
  const expiresAt=new Date(Date.now()+5*60*1000).toISOString();
  const {data,error:insertError}=await admin.from('hercules_cleaner_device_challenges').insert({
    activation_code_id:activation.id,
    device_id:device.deviceId,
    platform:device.platform,
    cleaner_version:device.version,
    public_key_pem:device.publicKeyPem,
    challenge_sha256:challengeHash,
    expires_at:expiresAt
  }).select('id').single();
  if(insertError)return json({ok:false,error:'challenge_create_failed'},500);
  return json({ok:true,challengeId:data.id,challenge,expiresAt});
}

async function activateDevice(body:any,admin:any){
  const device=cleanDevice(body);
  const code=cleanCode(body.activationCode);
  const challengeId=String(body.challengeId||'');
  const challenge=String(body.challenge||'');
  const signature=String(body.signature||'');
  if(!/^[0-9a-f-]{36}$/i.test(challengeId)||!challenge||challenge.length>512||!signature){
    return json({ok:false,error:'invalid_activation_proof'},400);
  }

  const {data:pending,error}=await admin.from('hercules_cleaner_device_challenges')
    .select('id,activation_code_id,device_id,platform,cleaner_version,public_key_pem,challenge_sha256,expires_at,used_at')
    .eq('id',challengeId)
    .maybeSingle();
  if(error)return json({ok:false,error:'challenge_lookup_failed'},500);
  if(!pending||pending.used_at||pending.expires_at<=new Date().toISOString()){
    return json({ok:false,error:'activation_challenge_unavailable'},409);
  }
  if(pending.device_id!==device.deviceId||
     pending.platform!==device.platform||
     pending.cleaner_version!==device.version||
     pending.public_key_pem!==device.publicKeyPem||
     pending.challenge_sha256!==await sha256(challenge)){
    return json({ok:false,error:'activation_challenge_mismatch'},409);
  }
  if(!await verifyEd25519(device.publicKeyPem,challenge,signature)){
    return json({ok:false,error:'device_signature_invalid'},401);
  }

  const credential=randomSecret(32);
  const credentialHash=await sha256(credential);
  const codeHash=await sha256(code);
  const {data,error:activateError}=await admin.rpc('hercules_activate_cleaner_device',{
    p_activation_code_sha256:codeHash,
    p_challenge_id:challengeId,
    p_device_id:device.deviceId,
    p_platform:device.platform,
    p_cleaner_version:device.version,
    p_public_key_pem:device.publicKeyPem,
    p_credential_sha256:credentialHash
  });
  if(activateError){
    const message=String(activateError.message||'');
    const conflict=message.includes('activation_code_unavailable')||message.includes('activation_challenge_unavailable');
    return json({ok:false,error:conflict?'activation_unavailable':'activation_failed'},conflict?409:500);
  }
  return json({...data,deviceCredential:credential});
}

Deno.serve(async req=>{
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  try{
    const body=await bodyJson(req);
    const action=String(body.action||'');
    const admin=createClient(U,S,{auth:{persistSession:false}});
    if(action==='issue_activation_code')return issueActivationCode(req,body,admin);
    if(action==='registration_challenge')return registrationChallenge(body,admin);
    if(action==='activate_device')return activateDevice(body,admin);
    return json({ok:false,error:'unknown_action'},400);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const status=message==='sensitive_device_metadata_rejected'?400:
      message==='request_too_large'?413:400;
    return json({ok:false,error:message},status);
  }
});
