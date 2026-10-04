import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const U=Deno.env.get('SUPABASE_URL')||'';
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const RENDER_API='https://api.render.com';
const COMMIT=/^[0-9a-f]{40}$/;
const DEPLOY=/^dep-[a-z0-9]+$/;
const SERVICE=/^srv-[a-z0-9]+$/;
const ACTIONS=new Set(['status','deploy','verify','rollback']);
const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};

const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});

async function sha256(value:string){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function sb(path:string,init:RequestInit={}){
  if(!U||!S)throw new Error('supabase_service_identity_unavailable');
  const headers=new Headers(init.headers||{});
  headers.set('apikey',S);
  headers.set('authorization','Bearer '+S);
  headers.set('accept','application/json');
  if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch(U+'/rest/v1/'+path,{...init,headers,redirect:'error'});
  const text=await response.text();
  if(!response.ok)throw new Error('supabase_request_failed');
  if(!text)return null;
  try{return JSON.parse(text)}catch{throw new Error('supabase_response_invalid')}
}
async function keyRow(purpose:string){
  const rows=await sb('hercules_internal_service_keys?select=purpose,key_sha256,secret_ref,enabled&purpose=eq.'+encodeURIComponent(purpose)+'&enabled=eq.true&limit=1');
  return Array.isArray(rows)?rows[0]||null:null;
}
async function secret(purpose:string){
  const row=await keyRow(purpose);
  if(!row?.secret_ref)throw new Error('credential_unavailable');
  const value=await sb('rpc/hercules_get_secret',{method:'POST',body:JSON.stringify({p_id:row.secret_ref})});
  if(typeof value!=='string'||value.trim().length<24)throw new Error('credential_unavailable');
  return value.trim();
}
async function authorized(req:Request){
  const raw=(req.headers.get('x-hercules-internal-key')||'').trim();
  if(raw.length<32)return false;
  const row=await keyRow('deploy-broker-control');
  if(!row?.key_sha256)return false;
  return safeEqual(String(row.key_sha256),await sha256(raw));
}
async function target(code:string){
  if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(code))throw new Error('target_invalid');
  const rows=await sb('hercules_deploy_targets?select=code,provider,service_id,public_origin,enabled&code=eq.'+encodeURIComponent(code)+'&enabled=eq.true&limit=1');
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row||row.provider!=='render'||!SERVICE.test(String(row.service_id||'')))throw new Error('target_unavailable');
  const origin=new URL(String(row.public_origin||''));
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('target_origin_invalid');
  return {code:String(row.code),serviceId:String(row.service_id),publicOrigin:origin.origin};
}
async function render(path:string,token:string,init:RequestInit={}){
  const headers=new Headers(init.headers||{});
  headers.set('authorization','Bearer '+token);
  headers.set('accept','application/json');
  if(init.body)headers.set('content-type','application/json');
  const response=await fetch(RENDER_API+path,{...init,headers,redirect:'error',signal:AbortSignal.timeout(10000)});
  const text=await response.text();
  let body:any={};
  if(text){try{body=JSON.parse(text)}catch{throw new Error('render_response_invalid')}}
  if(!response.ok)throw new Error('render_request_failed_'+response.status);
  return body;
}
async function verifyPublic(publicOrigin:string){
  const health=await fetch(publicOrigin+'/health',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!health.ok)throw new Error('health_verification_failed');
  const healthBody=await health.json().catch(()=>null);
  if(healthBody?.ok!==true||healthBody?.service!=='hercules-ai'||healthBody?.mcp!=='/mcp')throw new Error('health_verification_failed');
  const mcp=await fetch(publicOrigin+'/mcp',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'verify',method:'ping'}),signal:AbortSignal.timeout(5000)});
  if(![401,403].includes(mcp.status))throw new Error('mcp_protection_verification_failed');
  return {health:true,mcpProtected:true};
}

Deno.serve(async req=>{
  if(req.method==='GET')return out({ok:true,service:'hercules-deploy-broker',credentialCustody:'supabase_vault',carriesCredentials:false});
  if(req.method!=='POST')return out({error:'method_not_allowed'},405);
  if(!(await authorized(req)))return out({error:'unauthorized'},401);
  let body:any;
  try{body=await req.json()}catch{return out({error:'invalid_json'},400)}
  const action=String(body?.action||'').trim();
  if(!ACTIONS.has(action))return out({error:'action_denied'},400);
  try{
    const t=await target(String(body?.target||''));
    if(action==='status'){
      let configured=true;
      try{await secret('render-deployer')}catch{configured=false}
      return out({ok:true,action,target:t.code,provider:'render',credentialConfigured:configured,carriesCredentials:false});
    }
    const token=await secret('render-deployer');
    if(action==='deploy'){
      const sourceCommit=String(body?.source_commit||'').trim().toLowerCase();
      if(!COMMIT.test(sourceCommit))return out({error:'source_commit_invalid'},400);
      const result=await render('/v1/services/'+encodeURIComponent(t.serviceId)+'/deploys',token,{method:'POST',body:JSON.stringify({clearCache:'do_not_clear',commitId:sourceCommit})});
      const providerDeploymentId=String(result?.id||'');
      if(!DEPLOY.test(providerDeploymentId))throw new Error('render_deployment_id_invalid');
      return out({ok:true,action,target:t.code,provider:'render',providerDeploymentId,sourceCommit,carriesCredentials:false},202);
    }
    const providerDeploymentId=String(body?.provider_deployment_id||'').trim();
    if(!DEPLOY.test(providerDeploymentId))return out({error:'provider_deployment_id_invalid'},400);
    if(action==='verify'){
      const sourceCommit=String(body?.source_commit||'').trim().toLowerCase();
      if(!COMMIT.test(sourceCommit))return out({error:'source_commit_invalid'},400);
      const deployment=await render('/v1/services/'+encodeURIComponent(t.serviceId)+'/deploys/'+encodeURIComponent(providerDeploymentId),token);
      if(deployment?.status!=='live'||String(deployment?.commit?.id||'').toLowerCase()!==sourceCommit){
        return out({ok:false,action,target:t.code,provider:'render',providerDeploymentId,status:String(deployment?.status||'unknown'),exactCommit:false,carriesCredentials:false},409);
      }
      const publicEvidence=await verifyPublic(t.publicOrigin);
      return out({ok:true,action,target:t.code,provider:'render',providerDeploymentId,sourceCommit,exactCommit:true,...publicEvidence,carriesCredentials:false});
    }
    const rollback=await render('/v1/services/'+encodeURIComponent(t.serviceId)+'/rollback',token,{method:'POST',body:JSON.stringify({deployId:providerDeploymentId})});
    const rollbackDeploymentId=String(rollback?.id||'');
    if(!DEPLOY.test(rollbackDeploymentId))throw new Error('render_deployment_id_invalid');
    return out({ok:true,action,target:t.code,provider:'render',rollbackTargetDeploymentId:providerDeploymentId,providerDeploymentId:rollbackDeploymentId,carriesCredentials:false},202);
  }catch(error){
    const code=error instanceof Error?error.message:'deploy_broker_failed';
    const safe=/^(credential_unavailable|target_unavailable|target_invalid|target_origin_invalid|render_request_failed_[0-9]{3}|render_response_invalid|render_deployment_id_invalid|health_verification_failed|mcp_protection_verification_failed|supabase_service_identity_unavailable|supabase_request_failed|supabase_response_invalid)$/.test(code)?code:'deploy_broker_failed';
    return out({ok:false,error:safe,carriesCredentials:false},safe==='credential_unavailable'?503:502);
  }
});
