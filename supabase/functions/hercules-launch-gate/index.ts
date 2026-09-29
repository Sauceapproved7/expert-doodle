import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
const U=Deno.env.get('SUPABASE_URL')!;
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{persistSession:false}});
const ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const APPDEPLOY_STRIPE_APP_ID='sauceapproved-hercules-titan-dhakbi';
const APPDEPLOY_STRIPE_ATTESTATION_URL='https://sauceapproved-hercules-titan-dhakbi.v2.appdeploy.ai/api/provider-attestation';
const SHOPIFY_TITAN_PRODUCT_ID='gid://shopify/Product/10261114782016';
const TITAN_PRODUCT_CODE='hercules-titan-founding-access';
const SHOPIFY_STORE_DOMAIN='sauceapproved-2.myshopify.com';
const TITAN_OFFER_PACKET_VERSION='hercules-titan-founding-access-offer-v1';
const TITAN_OFFER_PACKET_DIGEST='8e9330f7cf70103e8fd8691cdd14a22d70eb466849c1b5a5fc98bc45c378a00f';
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
  const [launch,passwordProbe,liveAppDeployProvider]=await Promise.all([
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
    fetch(APPDEPLOY_STRIPE_ATTESTATION_URL,{headers:{'accept':'application/json','cache-control':'no-cache'},signal:AbortSignal.timeout(10_000)})
      .then(async r=>({ok:r.ok,status:r.status,body:await r.json().catch(()=>({}))}))
      .catch(()=>({ok:false,status:0,body:{}}))
  ]);

  const [{data:devbrain},{data:release},{data:recovery},{count:critical},{data:approvals},{data:stripe},{data:appDeployProviderEvidence},{data:paymentEvidence},{data:shopifyOfferEvidence},{data:titanOwnerApprovals},{data:passwordDefenseDb,error:passwordDefenseError}]=await Promise.all([
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
      .eq('key','appdeploy-stripe-provider-verified')
      .maybeSingle(),
    db.from('hercules_continuity_ledger')
      .select('status,value,provenance,verified_at')
      .eq('key','paid-billing-path-verified')
      .maybeSingle(),
    db.from('hercules_continuity_ledger')
      .select('status,value,provenance,verified_at')
      .eq('key','shopify-hercules-paid-offer-reconciled')
      .maybeSingle(),
    db.from('hercules_software_commercial_approvals')
      .select('approval_type,status,approved_at,document_ref,evidence')
      .eq('product_code',TITAN_PRODUCT_CODE)
      .in('approval_type',['pricing','terms','privacy','payment_path_verified'])
      .order('approval_type'),
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
    stripe?.metadata?.catalog_ready===true &&
    stripe?.metadata?.livemode===true &&
    stripe?.metadata?.webhook_endpoint_id
  );
  const liveAppDeployProviderValue=liveAppDeployProvider?.body||{};
  const liveAppDeployProviderFresh=Boolean(
    liveAppDeployProvider?.ok===true &&
    liveAppDeployProviderValue?.observedAt &&
    Math.abs(Date.now()-new Date(liveAppDeployProviderValue.observedAt).getTime())<5*60*1000
  );
  const liveAppDeployStripeReady=Boolean(
    liveAppDeployProviderFresh &&
    liveAppDeployProviderValue?.provider==='stripe' &&
    liveAppDeployProviderValue?.custody==='appdeploy' &&
    liveAppDeployProviderValue?.appId===APPDEPLOY_STRIPE_APP_ID &&
    liveAppDeployProviderValue?.credentialMode==='live' &&
    liveAppDeployProviderValue?.stripeReachable===true &&
    liveAppDeployProviderValue?.webhookConfigured===true
  );

  const appDeployProviderValue=appDeployProviderEvidence?.value||{};
  const ledgerAppDeployProviderFresh=Boolean(
    appDeployProviderEvidence?.verified_at &&
    Date.now()-new Date(appDeployProviderEvidence.verified_at).getTime()<24*60*60*1000
  );
  const ledgerAppDeployStripeReady=Boolean(
    appDeployProviderEvidence?.status==='active' &&
    ledgerAppDeployProviderFresh &&
    appDeployProviderValue?.provider==='stripe' &&
    appDeployProviderValue?.custody==='appdeploy' &&
    appDeployProviderValue?.appId===APPDEPLOY_STRIPE_APP_ID &&
    appDeployProviderValue?.credentialMode==='live' &&
    appDeployProviderValue?.stripeReachable===true &&
    appDeployProviderValue?.webhookConfigured===true
  );
  const appDeployStripeReady=Boolean(liveAppDeployStripeReady||ledgerAppDeployStripeReady);
  const paymentProviderReady=Boolean(vaultStripeReady||appDeployStripeReady);
  const paymentEvidenceValue=paymentEvidence?.value||{};
  const paymentEvidenceBound=Boolean(
    vaultStripeReady
      ? paymentEvidenceValue?.custody==='supabase-vault' &&
        paymentEvidenceValue?.accountKey===stripe?.account_key
      : appDeployStripeReady
        ? paymentEvidenceValue?.custody==='appdeploy' &&
          paymentEvidenceValue?.appId===APPDEPLOY_STRIPE_APP_ID
        : false
  );
  const paymentPathVerified=Boolean(
    paymentEvidence?.status==='active' &&
    paymentEvidence?.verified_at &&
    paymentEvidenceValue?.provider==='stripe' &&
    paymentEvidenceBound &&
    paymentEvidenceValue?.checkoutVerified===true &&
    paymentEvidenceValue?.refundVerified===true &&
    paymentEvidenceValue?.payoutStateVerified===true
  );

  const titanOwnerApprovalTypes=['pricing','terms','privacy'];
  const titanOwnerApprovalsComplete=Boolean(
    titanOwnerApprovalTypes.every(type=>
      (titanOwnerApprovals||[]).some((row:any)=>row.approval_type===type&&row.status==='approved')
    )
  );
  const titanPaymentPathVerified=Boolean(
    (titanOwnerApprovals||[]).some((row:any)=>
      row.approval_type==='payment_path_verified'&&row.status==='approved'
    )
  );

  const shopifyOfferValue=shopifyOfferEvidence?.value||{};
  const shopifyOfferFresh=Boolean(
    shopifyOfferEvidence?.verified_at &&
    Date.now()-new Date(shopifyOfferEvidence.verified_at).getTime()<24*60*60*1000
  );
  const shopifyOfferBase=Boolean(
    shopifyOfferEvidence?.status==='active' &&
    shopifyOfferFresh &&
    shopifyOfferValue?.storefront==='shopify' &&
    shopifyOfferValue?.shopDomain===SHOPIFY_STORE_DOMAIN &&
    shopifyOfferValue?.productId===SHOPIFY_TITAN_PRODUCT_ID &&
    shopifyOfferValue?.approvalPacketVersion===TITAN_OFFER_PACKET_VERSION &&
    shopifyOfferValue?.approvalPacketDigest===TITAN_OFFER_PACKET_DIGEST
  );
  const shopifyOfferAligned=Boolean(
    shopifyOfferBase &&
    titanOwnerApprovalsComplete &&
    titanPaymentPathVerified &&
    shopifyOfferValue?.disposition==='aligned_to_approved_offer' &&
    shopifyOfferValue?.priceCadenceVerified===true &&
    shopifyOfferValue?.entitlementVerified===true &&
    shopifyOfferValue?.refundCancellationVerified===true &&
    shopifyOfferValue?.deliveryVerified===true
  );
  const shopifyOfferExcluded=Boolean(
    shopifyOfferBase &&
    shopifyOfferValue?.disposition==='excluded_from_paid_launch' &&
    shopifyOfferValue?.purchaseExposureBlocked===true
  );
  const shopifyOfferReconciled=Boolean(shopifyOfferAligned||shopifyOfferExcluded);

  const commercial=Object.fromEntries((approvals||[]).map((x:any)=>[x.approval_type,x.status==='approved']));
  commercial.auth_hardening=passwordDefense.ok;
  commercial.payment_provider_ready=paymentProviderReady;
  commercial.payment_path_verified=paymentPathVerified;
  commercial.storefront_offer_reconciled=shopifyOfferReconciled;
  const requiredOwnerCommercial=['pricing','privacy','terms'];
  const technicalOk=Object.values(technical).every(Boolean);
  const commercialOk=passwordDefense.ok&&paymentProviderReady&&paymentPathVerified&&shopifyOfferReconciled&&requiredOwnerCommercial.every(k=>commercial[k]===true);

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
        providerReady:paymentProviderReady,
        custody:vaultStripeReady?'supabase-vault':appDeployStripeReady?'appdeploy':null,
        accountKey:vaultStripeReady?stripe?.account_key||null:null,
        connectedAt:vaultStripeReady?stripe?.connected_at||null:appDeployProviderEvidence?.verified_at||null,
        livemode:Boolean(vaultStripeReady?stripe?.metadata?.livemode===true:appDeployProviderValue?.credentialMode==='live'),
        webhookConfigured:Boolean(vaultStripeReady?stripe?.metadata?.webhook_endpoint_id:appDeployProviderValue?.webhookConfigured===true),
        providerAttestationFresh:appDeployStripeReady?appDeployProviderFresh:null,
        providerAttestationAt:appDeployProviderEvidence?.verified_at||null,
        providerAttestationProvenance:appDeployProviderEvidence?.provenance||null,
        providerAppId:appDeployStripeReady?APPDEPLOY_STRIPE_APP_ID:null,
        pathVerified:paymentPathVerified,
        pathVerifiedAt:paymentEvidence?.verified_at||null,
        pathProvenance:paymentEvidence?.provenance||null
      },
      storefrontOffer:{
        provider:'shopify',
        reconciled:shopifyOfferReconciled,
        disposition:shopifyOfferValue?.disposition||null,
        productId:shopifyOfferValue?.productId||SHOPIFY_TITAN_PRODUCT_ID,
        shopDomain:shopifyOfferValue?.shopDomain||SHOPIFY_STORE_DOMAIN,
        approvalPacketVersion:shopifyOfferValue?.approvalPacketVersion||null,
        approvalPacketDigest:shopifyOfferValue?.approvalPacketDigest||null,
        titanOwnerApprovalsComplete,
        titanPaymentPathVerified,
        titanOwnerApprovals:(titanOwnerApprovals||[]).map((row:any)=>({
          approvalType:row.approval_type,
          status:row.status,
          approvedAt:row.approved_at||null,
          documentRef:row.document_ref||null
        })),
        expectedPacketVersion:TITAN_OFFER_PACKET_VERSION,
        expectedPacketDigest:TITAN_OFFER_PACKET_DIGEST,
        verifiedAt:shopifyOfferEvidence?.verified_at||null,
        provenance:shopifyOfferEvidence?.provenance||null
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
      version:'2.0.0',
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
