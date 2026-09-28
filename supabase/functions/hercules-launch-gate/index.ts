import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
const U=Deno.env.get('SUPABASE_URL')!;
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{persistSession:false}});
const ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const APPDEPLOY_STRIPE_READINESS='https://sauceapproved-hercules-titan-dhakbi.v2.appdeploy.ai/api/billing/config';
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

async function appDeployStripeReadiness(){
  try{
    const response=await fetch(APPDEPLOY_STRIPE_READINESS,{
      headers:{accept:'application/json'},
      signal:AbortSignal.timeout(10_000)
    });
    const body=await response.json().catch(()=>({}));
    const accountFingerprint=typeof body?.accountFingerprint==='string'&&/^[a-f0-9]{64}$/.test(body.accountFingerprint)
      ? body.accountFingerprint
      : null;
    const ok=Boolean(
      response.ok&&
      body?.configured===true&&
      body?.webhookConfigured===true&&
      body?.stripeReachable===true&&
      body?.credentialMode==='live'&&
      accountFingerprint
    );
    return {
      ok,
      status:response.status,
      custody:'appdeploy-secrets',
      origin:new URL(APPDEPLOY_STRIPE_READINESS).origin,
      accountFingerprint:ok?accountFingerprint:null,
      credentialMode:body?.credentialMode||'unknown',
      stripeReachable:body?.stripeReachable===true,
      webhookConfigured:body?.webhookConfigured===true
    };
  }catch{
    return {
      ok:false,
      status:0,
      custody:'appdeploy-secrets',
      origin:new URL(APPDEPLOY_STRIPE_READINESS).origin,
      accountFingerprint:null,
      credentialMode:'unknown',
      stripeReachable:false,
      webhookConfigured:false
    };
  }
}

async function run(){
  const started=Date.now();
  const [launch,passwordProbe,appDeployStripe]=await Promise.all([
    fetch(U+'/functions/v1/hercules-launch?health=1',{signal:AbortSignal.timeout(10_000)})
      .then(async r=>({ok:r.ok&&(await r.json()).ok===true,status:r.status}))
      .catch(()=>({ok:false,status:0})),
    fetch(U+'/functions/v1/hercules-launch?password_defense_probe=compromised',{signal:AbortSignal.timeout(10_000)})
      .then(async r=>{
        const body=await r.json().catch(()=>({}));
        return {
          ok:Boolean(r.ok&&body?.ok===true&&body?.password_defense==='hercules-password-defense-v2'&&body?.result?.error==='compromised_password'),
          status:r.status,
          control:body?.password_defense||null,
          probe:body?.probe||null
        };
      })
      .catch(()=>({ok:false,status:0,control:null,probe:null})),
    appDeployStripeReadiness()
  ]);

  const [{data:devbrain},{data:release},{data:recovery},{count:critical},{data:approvals},{data:stripe},{data:catalogEvidence},{data:paymentEvidence},{data:passwordDefenseDb,error:passwordDefenseError}]=await Promise.all([
    db.from('hercules_devbrain_fabric_checks').select('overall_ok,checked_at').eq('organization_id',ORG).order('checked_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('hercules_release_queue').select('release_id,status,environment,admission_decision,flight_record_hash,updated_at').eq('organization_id',ORG).eq('environment','production').eq('status','verified').eq('admission_decision','allow').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('hercules_recovery_snapshots').select('snapshot_id,status,verified_at,recovery_region').eq('organization_id',ORG).eq('status','verified').order('verified_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('hercules_security_events').select('*',{count:'exact',head:true}).eq('organization_id',ORG).eq('severity','critical').eq('disposition','open'),
    db.from('hercules_launch_approvals').select('approval_type,status,approved_at').order('approval_type'),
    db.from('hercules_provider_connections')
      .select('account_key,status,connected_at,access_secret_ref,signing_secret_ref,metadata,updated_at')
      .eq('organization_id',ORG)
      .eq('provider','stripe')
      .eq('status','active')
      .not('access_secret_ref','is',null)
      .not('signing_secret_ref','is',null)
      .order('updated_at',{ascending:false})
      .limit(1)
      .maybeSingle(),
    db.from('hercules_continuity_ledger')
      .select('status,value,provenance,verified_at')
      .eq('key','stripe-catalog-verified')
      .maybeSingle(),
    db.from('hercules_continuity_ledger')
      .select('status,value,provenance,verified_at')
      .eq('key','paid-billing-path-verified')
      .maybeSingle(),
    db.rpc('hercules_password_defense_status')
  ]);
  const passwordDefense={
    ok:Boolean(!passwordDefenseError&&passwordDefenseDb?.ok===true&&passwordProbe.ok===true),
    control:'hercules-password-defense-v2',
    database:passwordDefenseError?{ok:false,error:'status_unavailable'}:passwordDefenseDb,
    browserProbe:passwordProbe
  };

  const devbrainFresh=Boolean(devbrain?.overall_ok&&Date.now()-new Date(devbrain.checked_at).getTime()<24*60*60*1000);
  const technical={
    launch_surface:launch.ok,
    devbrain:devbrainFresh,
    signed_production_release:Boolean(release?.flight_record_hash),
    verified_cross_region_recovery:Boolean(recovery?.verified_at),
    no_open_critical_events:Number(critical||0)===0
  };

  const vaultStripeReady=Boolean(
    stripe?.account_key &&
    stripe?.connected_at &&
    stripe?.metadata?.livemode===true &&
    stripe?.metadata?.webhook_endpoint_id
  );
  const appDeployStripeReady=Boolean(appDeployStripe.ok&&appDeployStripe.accountFingerprint);
  const paymentProviderAuthorized=Boolean(vaultStripeReady||appDeployStripeReady);
  const providerAccountFingerprint=vaultStripeReady
    ? await sha(String(stripe.account_key))
    : appDeployStripeReady
      ? appDeployStripe.accountFingerprint
      : null;
  const catalogEvidenceValue=catalogEvidence?.value||{};
  const catalogReady=Boolean(
    (vaultStripeReady&&stripe?.metadata?.catalog_ready===true)||
    (
      appDeployStripeReady&&
      catalogEvidence?.status==='active'&&
      catalogEvidence?.verified_at&&
      catalogEvidenceValue?.provider==='stripe'&&
      catalogEvidenceValue?.catalogVerified===true&&
      catalogEvidenceValue?.accountFingerprint===providerAccountFingerprint
    )
  );
  const paymentProviderReady=Boolean(paymentProviderAuthorized&&catalogReady);
  const paymentEvidenceValue=paymentEvidence?.value||{};
  const paymentPathVerified=Boolean(
    paymentEvidence?.status==='active' &&
    paymentEvidence?.verified_at &&
    paymentEvidenceValue?.provider==='stripe' &&
    paymentEvidenceValue?.accountFingerprint===providerAccountFingerprint &&
    paymentEvidenceValue?.checkoutVerified===true &&
    paymentEvidenceValue?.refundVerified===true &&
    paymentEvidenceValue?.payoutStateVerified===true
  );

  const commercial=Object.fromEntries((approvals||[]).map((x:any)=>[x.approval_type,x.status==='approved']));
  commercial.auth_hardening=passwordDefense.ok;
  commercial.payment_provider_ready=paymentProviderReady;
  commercial.payment_path_verified=paymentPathVerified;
  const requiredOwnerCommercial=['pricing','privacy','terms'];
  const technicalOk=Object.values(technical).every(Boolean);
  const commercialOk=passwordDefense.ok&&paymentProviderReady&&paymentPathVerified&&requiredOwnerCommercial.every(k=>commercial[k]===true);

  const checks={
    technical,
    commercial,
    evidence:{
      release_id:release?.release_id||null,
      recovery_snapshot_id:recovery?.snapshot_id||null,
      recovery_region:recovery?.recovery_region||null,
      devbrain_checked_at:devbrain?.checked_at||null,
      password_defense:passwordDefense,
      payment:{
        provider:'stripe',
        providerAuthorized:paymentProviderAuthorized,
        providerReady:paymentProviderReady,
        custody:vaultStripeReady?'supabase-vault':appDeployStripeReady?'appdeploy-secrets':null,
        accountKey:vaultStripeReady?stripe?.account_key||null:null,
        accountFingerprint:providerAccountFingerprint,
        connectedAt:vaultStripeReady?stripe?.connected_at||null:null,
        livemode:Boolean(vaultStripeReady?stripe?.metadata?.livemode===true:appDeployStripe.credentialMode==='live'),
        catalogReady,
        catalogVerifiedAt:catalogEvidence?.verified_at||null,
        catalogProvenance:catalogEvidence?.provenance||null,
        webhookConfigured:Boolean(vaultStripeReady?stripe?.metadata?.webhook_endpoint_id:appDeployStripe.webhookConfigured),
        appDeployAttestation:appDeployStripe,
        pathVerified:paymentPathVerified,
        pathVerifiedAt:paymentEvidence?.verified_at||null,
        pathProvenance:paymentEvidence?.provenance||null
      }
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
      version:'1.4.0',
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
