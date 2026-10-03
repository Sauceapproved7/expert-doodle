import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const URL=Deno.env.get('SUPABASE_URL')!,PUBLIC=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const G4F='https://sauceapproved-g4f-production.up.railway.app/v1/chat/completions';
const AI_CHAIN=[{provider:'LLM7',model:'default'},{provider:'KiloCode',model:'kilo-auto/free'}];
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type, x-hercules-internal-key','access-control-allow-methods':'POST, OPTIONS'};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...cors,'content-type':'application/json'}});
const globalAdmin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));

async function internalAuthorized(req:Request){
  const key=req.headers.get('x-hercules-internal-key')||'';
  if(!key)return false;
  const digest=await sha(key);
  const {data}=await globalAdmin.from('hercules_internal_service_keys')
    .select('purpose,key_sha256,enabled')
    .in('purpose',['agent-coordinator','forge-interpreter'])
    .eq('enabled',true);
  return Boolean((data||[]).some((row:any)=>row.enabled&&row.key_sha256===digest));
}

async function routeInternal(system:string,prompt:string){
  const {data:key,error:kerr}=await globalAdmin.rpc('hercules_g4f_key');
  if(kerr||!key)throw new Error('ai_provider_unavailable');
  const attempts:any[]=[];
  for(const candidate of AI_CHAIN){
    try{
      const response=await fetch(G4F,{
        method:'POST',
        headers:{'content-type':'application/json','g4f-api-key':String(key)},
        body:JSON.stringify({
          model:candidate.model,
          provider:candidate.provider,
          stream:false,
          messages:[
            ...(system?[{role:'system',content:system}]:[]),
            {role:'user',content:prompt}
          ]
        }),
        signal:AbortSignal.timeout(45000)
      });
      const raw=await response.text();
      if(!response.ok){attempts.push({provider:candidate.provider,status:response.status});continue;}
      let data:any;
      try{data=JSON.parse(raw)}catch{attempts.push({provider:candidate.provider,error:'invalid_ai_response'});continue;}
      const text=String(data?.choices?.[0]?.message?.content||'').trim();
      if(text){
        const usage=data?.usage&&typeof data.usage==='object'?{
          input_tokens:Math.max(0,Number(data.usage.input_tokens??data.usage.prompt_tokens??0)||0),
          output_tokens:Math.max(0,Number(data.usage.output_tokens??data.usage.completion_tokens??0)||0),
          total_tokens:Math.max(0,Number(data.usage.total_tokens??0)||0)
        }:null;
        return {text,provider:candidate.provider,model:String(data?.model||candidate.model),attempts,usage};
      }
      attempts.push({provider:candidate.provider,error:'empty_ai_response'});
    }catch(e){
      attempts.push({provider:candidate.provider,error:e instanceof Error?e.name:'ai_provider_unreachable'});
    }
  }
  const err=new Error('ai_provider_chain_failed');
  (err as any).attempts=attempts;
  throw err;
}
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return out({error:'method_not_allowed'},405);
 let body:any={};try{body=await req.json()}catch{return out({error:'invalid_json'},400)};
 if(String(body.action||'')==='route_internal'){
   if(!(await internalAuthorized(req)))return out({error:'internal_authorization_required'},403);
   const system=String(body.system||'').trim().slice(0,12000);
   const prompt=String(body.prompt||'').trim().slice(0,16000);
   if(!prompt)return out({error:'prompt_required'},400);
   try{
     const routed=await routeInternal(system,prompt);
     return out({ok:true,result:routed.text,provider:routed.provider,model:routed.model,attempts:routed.attempts,usage:routed.usage});
   }catch(e){
     return out({error:e instanceof Error?e.message:'ai_provider_chain_failed',attempts:(e as any)?.attempts||[]},502);
   }
 }
 const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return out({error:'unauthorized'},401);
 const sb=createClient(URL,PUBLIC,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user}}=await sb.auth.getUser();if(!user)return out({error:'unauthorized'},401);
 const projectId=String(body.projectId||'').slice(0,80),prompt=String(body.prompt||'').trim().slice(0,4000);if(!projectId||!prompt)return out({error:'missing_input'},400);
 const {data:project}=await sb.from('hercules_projects').select('id,name,goal').eq('id',projectId).eq('user_id',user.id).maybeSingle();if(!project)return out({error:'project_not_found'},404);
 const {data:quota,error:qerr}=await admin.rpc('hercules_consume_ai_run',{p_user:user.id});const q=Array.isArray(quota)?quota[0]:quota;if(qerr||!q)return out({error:'usage_check_failed'},503);if(!q.allowed)return out({error:'usage_limit_reached',used:q.used,limit:q.run_limit},429);
 const refund=()=>admin.rpc('hercules_refund_ai_run',{p_user:user.id});
 const {data:key,error:kerr}=await admin.rpc('hercules_g4f_key');if(kerr||!key){await refund();return out({error:'ai_provider_unavailable'},503)};
 const {data:recent}=await sb.from('hercules_sessions').select('prompt,result').eq('project_id',project.id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(8);
 const memory=(recent||[]).reverse().map((r:any)=>`User: ${r.prompt}\nHercules: ${r.result}`).join('\n\n').slice(-12000);
 const system=`You are Hercules, an AI business execution assistant by SauceApproved. Be concrete, prioritized, commercially useful, and concise. Never claim an external action was completed unless evidence is provided. Project: ${project.name}. Goal: ${project.goal}.${memory?`\nRecent project memory:\n${memory}`:''}`;
 let data:any=null,text='',selected:any=null;const attempts:any[]=[];
 for(const candidate of AI_CHAIN){
   try{
     const response=await fetch(G4F,{method:'POST',headers:{'content-type':'application/json','g4f-api-key':String(key)},body:JSON.stringify({model:candidate.model,provider:candidate.provider,stream:false,messages:[{role:'system',content:system},{role:'user',content:prompt}]}),signal:AbortSignal.timeout(45000)});
     const raw=await response.text();
     if(!response.ok){attempts.push({provider:candidate.provider,status:response.status,error:raw.slice(0,160)});continue;}
     try{data=JSON.parse(raw)}catch{attempts.push({provider:candidate.provider,error:'invalid_ai_response'});continue;}
     text=String(data?.choices?.[0]?.message?.content||'').trim();
     if(text){selected=candidate;break;}
     attempts.push({provider:candidate.provider,error:'empty_ai_response'});
   }catch(e){attempts.push({provider:candidate.provider,error:e instanceof Error?e.name:'ai_provider_unreachable'});}
 }
 if(!selected){await refund();return out({error:'ai_provider_chain_failed',attempts:attempts.map(x=>({provider:x.provider,status:x.status||null,error:x.error||'failed'}))},502)};
 await admin.from('hercules_sessions').insert({user_id:user.id,project_id:project.id,prompt,result:text});
 return out({result:text,used:q.used,limit:q.run_limit,provider:selected.provider,model:selected.model});
});