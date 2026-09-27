import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
const U=Deno.env.get('SUPABASE_URL')!;
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{persistSession:false}});
const ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));

async function authorized(req:Request){
  const key=req.headers.get('x-hercules-internal-key')||'';
  if(!key)return false;
  const {data}=await db.from('hercules_internal_service_keys').select('key_sha256,enabled').eq('purpose','agent-coordinator').eq('enabled',true).maybeSingle();
  return Boolean(data?.enabled&&data.key_sha256===await sha(key));
}

async function publicRegistrationOpen(){
  const {data}=await db.from('hercules_continuity_ledger')
    .select('status,value,verified_at')
    .eq('key','public-registration-open')
    .maybeSingle();
  return {
    open:Boolean(data?.status==='active'&&data?.value?.open===true),
    verifiedAt:data?.verified_at||null
  };
}

async function run(){
  const started=Date.now();
  const launch=await fetch(U+'/functions/v1/hercules-launch?health=1',{signal:AbortSignal.timeout(10_000)})
    .then(async r=>({ok:r.ok&&(await r.json()).ok===true,status:r.status}))
    .catch(()=>({ok:false,status:0}));

  const [{data:devbrain},{data:release},{data:recovery},{count:critical},{data:approvals}]=await Promise.all([
    db.from('hercules_devbrain_fabric_checks').select('overall_ok,checked_at').eq('organization_id',ORG).order('checked_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('hercules_release_queue').select('release_id,status,environment,admission_decision,flight_record_hash,updated_at').eq('organization_id',ORG).eq('environment','production').eq('status','verified').eq('admission_decision','allow').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('hercules_recovery_snapshots').select('snapshot_id,status,verified_at,recovery_region').eq('organization_id',ORG).eq('status','verified').order('verified_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('hercules_security_events').select('*',{count:'exact',head:true}).eq('organization_id',ORG).eq('severity','critical').eq('disposition','open'),
    db.from('hercules_launch_approvals').select('approval_type,status,approved_at').order('approval_type')
  ]);

  const devbrainFresh=Boolean(devbrain?.overall_ok&&Date.now()-new Date(devbrain.checked_at).getTime()<24*60*60*1000);
  const technical={
    launch_surface:launch.ok,
    devbrain:devbrainFresh,
    signed_production_release:Boolean(release?.flight_record_hash),
    verified_cross_region_recovery:Boolean(recovery?.verified_at),
    no_open_critical_events:Number(critical||0)===0
  };

  const commercial=Object.fromEntries((approvals||[]).map((x:any)=>[x.approval_type,x.status==='approved']));
  const requiredCommercial=['auth_hardening','pricing','privacy','terms'];
  const technicalOk=Object.values(technical).every(Boolean);
  const commercialOk=requiredCommercial.every(k=>commercial[k]===true);

  const checks={
    technical,
    commercial,
    evidence:{
      release_id:release?.release_id||null,
      recovery_snapshot_id:recovery?.snapshot_id||null,
      recovery_region:recovery?.recovery_region||null,
      devbrain_checked_at:devbrain?.checked_at||null
    },
    duration_ms:Date.now()-started
  };

  const {data,error}=await db.from('hercules_launch_gate_checks')
    .insert({organization_id:ORG,technical_ok:technicalOk,commercial_ok:commercialOk,checks})
    .select('technical_ok,commercial_ok,launch_ready,checks,checked_at')
    .single();
  if(error)throw error;
  return data;
}

Deno.serve(async req=>{
  if(req.method==='GET'){
    const [{data},registration]=await Promise.all([
      db.from('hercules_launch_gate_checks')
        .select('technical_ok,commercial_ok,launch_ready,checks,checked_at')
        .eq('organization_id',ORG)
        .order('checked_at',{ascending:false})
        .limit(1)
        .maybeSingle(),
      publicRegistrationOpen()
    ]);
    return out({
      ok:true,
      service:'hercules-launch-gate',
      version:'1.1.0',
      lastCheck:data||null,
      publicRegistrationOpen:registration.open,
      publicRegistrationVerifiedAt:registration.verifiedAt
    });
  }

  if(req.method!=='POST')return out({error:'method_not_allowed'},405);
  if(!await authorized(req))return out({error:'internal_authorization_required'},403);

  try{
    const [check,registration]=await Promise.all([run(),publicRegistrationOpen()]);
    return out({
      ok:check.launch_ready,
      check,
      publicRegistrationOpen:registration.open,
      publicRegistrationVerifiedAt:registration.verifiedAt
    },check.launch_ready?200:409);
  }catch(e){
    return out({error:'launch_gate_failed',detail:e instanceof Error?e.message:'unknown'},500);
  }
});
