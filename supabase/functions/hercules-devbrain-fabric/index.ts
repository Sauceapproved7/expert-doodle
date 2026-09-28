import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildDevBrainBrowserProbe, evaluateDevBrainBrowserProbe } from './browser-check.mjs';

const U=Deno.env.get('SUPABASE_URL')!;
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{persistSession:false}});
const ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const unhex=(s:string)=>{
  if(!/^[0-9a-f]{64}$/i.test(s))return null;
  const out=new Uint8Array(s.length/2);
  for(let i=0;i<s.length;i+=2)out[i/2]=Number.parseInt(s.slice(i,i+2),16);
  return out;
};

async function authorized(req:Request){
  const key=req.headers.get('x-hercules-internal-key')||'';
  if(!key)return false;
  const {data}=await db.from('hercules_internal_service_keys').select('key_sha256,enabled').eq('purpose','agent-coordinator').eq('enabled',true).maybeSingle();
  return Boolean(data?.enabled&&data.key_sha256===await sha(key));
}

async function getInternalSecret(purpose:string){
  const {data:row}=await db.from('hercules_internal_service_keys')
    .select('secret_ref,enabled').eq('purpose',purpose).eq('enabled',true).maybeSingle();
  if(!row?.secret_ref)return null;
  const {data:secret}=await db.rpc('hercules_get_secret',{p_id:row.secret_ref});
  return secret?String(secret):null;
}

async function schedulerAuthorized(req:Request){
  const timestamp=req.headers.get('x-hercules-cron-timestamp')||'';
  const signature=req.headers.get('x-hercules-cron-signature')||'';
  const present=Boolean(timestamp||signature);
  if(!present)return {ok:false,present:false,error:'scheduler_signature_missing'};
  if(!/^\d{10}$/.test(timestamp))return {ok:false,present:true,error:'scheduler_signature_invalid'};
  const age=Math.abs(Math.floor(Date.now()/1000)-Number(timestamp));
  if(!Number.isFinite(age)||age>300)return {ok:false,present:true,error:'scheduler_signature_expired'};
  const signatureBytes=unhex(signature);
  if(!signatureBytes)return {ok:false,present:true,error:'scheduler_signature_invalid'};
  const secret=await getInternalSecret('agent-coordinator');
  if(!secret)return {ok:false,present:true,error:'scheduler_credential_unavailable'};
  const material=new TextEncoder().encode(timestamp+'\nPOST\n/hercules-devbrain-fabric');
  const key=await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},
    false,
    ['verify']
  );
  const ok=await crypto.subtle.verify('HMAC',key,signatureBytes,material);
  return ok
    ? {ok:true,present:true,error:null}
    : {ok:false,present:true,error:'scheduler_signature_invalid'};
}

async function aiCheck(){
  const started=Date.now();
  const key=await getInternalSecret('agent-coordinator');
  if(!key)return {ok:false,provider:'none',latency:Date.now()-started,detail:'router_credential_unavailable'};
  try{
    const r=await fetch(U+'/functions/v1/hercules-ai',{
      method:'POST',
      headers:{'content-type':'application/json','x-hercules-internal-key':key},
      body:JSON.stringify({action:'route_internal',prompt:'Return exactly HERCULES_AI_OK'}),
      signal:AbortSignal.timeout(60_000)
    });
    const p=await r.json().catch(()=>({}));
    const text=String(p?.result||'').trim();
    return {
      ok:r.ok&&text.includes('HERCULES_AI_OK'),
      provider:String(p?.provider||'hercules-ai'),
      latency:Date.now()-started,
      detail:r.ok?'completion_received':p?.attempts||'router_failed'
    };
  }catch(e){
    return {ok:false,provider:'hercules-ai',latency:Date.now()-started,detail:e instanceof Error?e.name:'request_failed'};
  }
}

async function browserCheck(){
  const started=Date.now();
  const key=await getInternalSecret('browser-gateway');
  if(!key)return {ok:false,engine:'hercules-browser',latency:Date.now()-started,detail:'browser_gateway_credential_unavailable'};

  try{
    const r=await fetch(U+'/functions/v1/hercules-browser',{
      method:'POST',
      headers:{'content-type':'application/json','x-hercules-internal-key':key},
      body:JSON.stringify(buildDevBrainBrowserProbe()),
      signal:AbortSignal.timeout(45_000)
    });
    const p=await r.json().catch(()=>({}));
    const evaluated=evaluateDevBrainBrowserProbe(r.status,p);
    return {
      ok:evaluated.ok,
      engine:'hercules-browser',
      latency:Date.now()-started,
      detail:evaluated.ok
        ? {traceId:evaluated.traceId,pageUrl:evaluated.pageUrl,title:evaluated.title}
        : {status:evaluated.status,error:p?.error||p?.detail||'browser_probe_failed'}
    };
  }catch(e){
    return {ok:false,engine:'hercules-browser',latency:Date.now()-started,detail:e instanceof Error?e.name:'request_failed'};
  }
}

async function wasmCheck(){
  const started=Date.now();
  try{
    const bytes=new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,3,2,1,0,7,7,1,3,114,117,110,0,0,10,6,1,4,0,65,42,11]);
    const instance=await WebAssembly.instantiate(bytes,{});
    const result=Number((instance.instance.exports.run as CallableFunction)());
    return {ok:result===42,result,latency:Date.now()-started,detail:'isolated_wasm_selftest'};
  }catch(e){
    return {ok:false,result:0,latency:Date.now()-started,detail:e instanceof Error?e.name:'wasm_failed'};
  }
}

Deno.serve(async(req:Request)=>{
  if(req.method==='GET'){
    const {data:last}=await db.from('hercules_devbrain_fabric_checks')
      .select('ai_ok,browser_ok,wasm_ok,overall_ok,ai_provider,browser_engine,wasm_result,latency_ms,detail,checked_at')
      .eq('organization_id',ORG).order('checked_at',{ascending:false}).limit(1).maybeSingle();
    return out({ok:true,service:'hercules-devbrain-fabric',version:'1.2.0',mode:'owned-provider-fabric',lastCheck:last||null});
  }

  if(req.method!=='POST')return out({error:'method_not_allowed'},405);
  const internal=await authorized(req);
  if(!internal){
    const scheduler=await schedulerAuthorized(req);
    if(!scheduler.ok){
      return out({error:scheduler.present?scheduler.error:'internal_authorization_required'},403);
    }
  }

  const [ai,browser,wasm]=await Promise.all([aiCheck(),browserCheck(),wasmCheck()]);
  const check={
    organization_id:ORG,
    ai_ok:ai.ok,
    browser_ok:browser.ok,
    wasm_ok:wasm.ok,
    ai_provider:ai.provider,
    browser_engine:browser.engine,
    wasm_result:wasm.result,
    latency_ms:{ai:ai.latency,browser:browser.latency,wasm:wasm.latency},
    detail:{ai:ai.detail,browser:browser.detail,wasm:wasm.detail}
  };

  const {data,error}=await db.from('hercules_devbrain_fabric_checks').insert(check)
    .select('ai_ok,browser_ok,wasm_ok,overall_ok,ai_provider,browser_engine,wasm_result,latency_ms,detail,checked_at').single();
  if(error)return out({error:'check_persist_failed',detail:error.message},500);

  await db.from('hercules_observability_rollups').insert([
    {organization_id:ORG,metric_name:'devbrain.ai.ok',metric_value:ai.ok?1:0,dimensions:{provider:ai.provider}},
    {organization_id:ORG,metric_name:'devbrain.browser.ok',metric_value:browser.ok?1:0,dimensions:{engine:browser.engine}},
    {organization_id:ORG,metric_name:'devbrain.wasm.ok',metric_value:wasm.ok?1:0,dimensions:{result:wasm.result}}
  ]);

  if(!data.overall_ok){
    await db.from('hercules_security_events').insert({
      organization_id:ORG,severity:'high',event_type:'devbrain.fabric_check_failed',evidence:data
    });
  }

  return out({ok:Boolean(data.overall_ok),check:data},data.overall_ok?200:503);
});
