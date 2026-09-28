import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=Deno.env.get('SUPABASE_ANON_KEY')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const RETURN_URL=U+'/functions/v1/hercules-integrations';
const PRODUCTS=['sauceapproved-studio','sauceapproved-ads'] as const;
const PRICE_GUARD={starter:2900,pro:7900,agency:19900} as const;
const admin=createClient(U,S,{auth:{persistSession:false}});

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  }
});

async function ownerAuth(req:Request){
  const db=createClient(U,A,{
    global:{headers:{Authorization:req.headers.get('authorization')||''}},
    auth:{persistSession:false}
  });
  const {data:{user}}=await db.auth.getUser();
  if(!user)return null;
  const {data:membership}=await db.from('hercules_memberships')
    .select('organization_id,role,status')
    .eq('organization_id',ORG)
    .eq('user_id',user.id)
    .eq('status','active')
    .eq('role','owner')
    .limit(1)
    .maybeSingle();
  return membership?{db,user,membership}:null;
}

async function secret(ref:string){
  const {data,error}=await admin.rpc('hercules_get_secret',{p_id:ref});
  if(error)throw error;
  if(!data)throw new Error('stripe_secret_unavailable');
  return String(data);
}

async function stripe(key:string,path:string,init:RequestInit={}){
  const response=await fetch('https://api.stripe.com/v1/'+path,{
    ...init,
    headers:{Authorization:'Bearer '+key,...(init.headers||{})},
    signal:AbortSignal.timeout(30000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body?.error?.message||('stripe_http_'+response.status));
  return body;
}

async function stripeForm(key:string,path:string,form:URLSearchParams){
  return stripe(key,path,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:form
  });
}

async function commercialPrerequisites(productCode:string){
  const {data,error}=await admin.from('hercules_software_commercial_approvals')
    .select('approval_type,status')
    .eq('product_code',productCode)
    .in('approval_type',['pricing','terms','privacy','payment_provider_ready','payment_path_verified']);
  if(error)throw error;
  const status=Object.fromEntries((data||[]).map((row:any)=>[row.approval_type,row.status]));
  const ownerReady=['pricing','terms','privacy'].every(key=>status[key]==='approved');
  const providerReady=status.payment_provider_ready==='approved';
  return {status,ownerReady,providerReady,paymentPathVerified:status.payment_path_verified==='approved'};
}

async function stripeConnection(){
  const {data,error}=await admin.from('hercules_provider_connections')
    .select('account_key,access_secret_ref,status,connected_at,metadata,updated_at')
    .eq('organization_id',ORG)
    .eq('provider','stripe')
    .eq('status','active')
    .not('access_secret_ref','is',null)
    .order('updated_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function latestRun(productCode:string){
  const {data,error}=await admin.from('hercules_software_payment_verification_runs')
    .select('id,product_code,plan_code,stripe_account_id,livemode,expected_amount_cents,status,checkout_session_id,provider_customer_id,provider_subscription_id,invoice_id,payment_intent_id,refund_id,evidence,created_at,updated_at,completed_at')
    .eq('organization_id',ORG)
    .eq('product_code',productCode)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function status(){
  const connection=await stripeConnection();
  const products:any[]=[];
  for(const productCode of PRODUCTS){
    const prerequisites=await commercialPrerequisites(productCode);
    const {data:catalog,error:catalogError}=await admin.from('hercules_software_stripe_catalog')
      .select('product_code,plan_code,stripe_account_id,stripe_product_id,stripe_price_id,unit_amount_cents,currency,livemode,active,synced_at')
      .eq('product_code',productCode)
      .order('unit_amount_cents');
    if(catalogError)throw catalogError;
    products.push({
      product_code:productCode,
      prerequisites,
      catalog:catalog||[],
      latest_run:await latestRun(productCode)
    });
  }
  return {
    ok:true,
    service:'hercules-software-payment-verify',
    version:'1.0.0',
    mode:'live_refund_verification',
    stripe:connection?{
      status:connection.status,
      account_key:connection.account_key,
      livemode:Boolean(connection.metadata?.livemode),
      connected_at:connection.connected_at
    }:{status:'not_connected'},
    products
  };
}

Deno.serve(async req=>{
  if(req.method==='GET')return json({
    ok:true,
    service:'hercules-software-payment-verify',
    version:'1.0.0',
    mode:'live_refund_verification',
    charge_behavior:'checkout_requires_owner_completion_then_auto_cancel_and_refund',
    products:PRODUCTS
  });
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);

  const auth=await ownerAuth(req);
  if(!auth)return json({error:'owner_required'},403);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||'status');

  if(action==='status'){
    try{return json(await status())}
    catch(error){return json({error:'software_payment_status_failed',detail:error instanceof Error?error.message:String(error)},500)}
  }

  if(action==='prepare_live_verification'){
    try{
      const productCode=String(body.product_code||'');
      const planCode=String(body.plan_code||'starter');
      if(!PRODUCTS.includes(productCode as any))return json({error:'valid_product_code_required'},400);
      if(planCode!=='starter')return json({error:'verification_uses_starter_plan_only'},400);

      const prerequisites=await commercialPrerequisites(productCode);
      if(!prerequisites.ownerReady)return json({error:'owner_approvals_required'},409);
      if(!prerequisites.providerReady)return json({error:'stripe_provider_required'},409);
      if(prerequisites.paymentPathVerified)return json({error:'payment_path_already_verified'},409);

      const connection=await stripeConnection();
      if(!connection?.access_secret_ref)return json({error:'stripe_provider_required'},409);
      if(connection.metadata?.livemode!==true)return json({error:'live_stripe_required'},409);

      const key=await secret(String(connection.access_secret_ref));
      const account=await stripe(key,'account');
      if(!account?.id||String(account.id)!==String(connection.account_key)){
        return json({error:'stripe_account_identity_mismatch'},409);
      }

      const {data:catalog,error:catalogError}=await admin.from('hercules_software_stripe_catalog')
        .select('product_code,plan_code,stripe_account_id,stripe_price_id,unit_amount_cents,currency,livemode,active')
        .eq('product_code',productCode)
        .eq('plan_code',planCode)
        .eq('active',true)
        .single();
      if(catalogError||!catalog)return json({error:'software_stripe_catalog_required'},409);

      const expected=PRICE_GUARD[planCode as keyof typeof PRICE_GUARD];
      if(Number(catalog.unit_amount_cents)!==expected||
         catalog.currency!=='usd'||
         catalog.livemode!==true||
         String(catalog.stripe_account_id)!==String(account.id)){
        return json({error:'software_stripe_catalog_mismatch'},409);
      }

      const {data:run,error:runError}=await admin.from('hercules_software_payment_verification_runs')
        .insert({
          organization_id:ORG,
          product_code:productCode,
          plan_code:planCode,
          stripe_account_id:String(account.id),
          livemode:true,
          expected_amount_cents:expected,
          status:'prepared',
          started_by:auth.user.id,
          evidence:{
            purpose:'controlled_live_checkout_cancel_refund',
            automatic_cancel:true,
            automatic_refund:true,
            owner_completion_required:true
          }
        })
        .select('id')
        .single();
      if(runError)throw runError;

      const runId=String(run.id);
      const form=new URLSearchParams();
      form.set('mode','subscription');
      form.set('payment_method_collection','always');
      form.set('line_items[0][price]',String(catalog.stripe_price_id));
      form.set('line_items[0][quantity]','1');
      form.set('client_reference_id',ORG);
      if(auth.user.email)form.set('customer_email',String(auth.user.email));
      form.set('success_url',RETURN_URL+'?software_payment_verify=success&session_id={CHECKOUT_SESSION_ID}');
      form.set('cancel_url',RETURN_URL+'?software_payment_verify=cancelled');
      form.set('metadata[organizationId]',ORG);
      form.set('metadata[softwareProductCode]',productCode);
      form.set('metadata[softwarePlanCode]',planCode);
      form.set('metadata[verificationRunId]',runId);
      form.set('metadata[purpose]','software_payment_verification');
      form.set('subscription_data[metadata][organizationId]',ORG);
      form.set('subscription_data[metadata][softwareProductCode]',productCode);
      form.set('subscription_data[metadata][softwarePlanCode]',planCode);
      form.set('subscription_data[metadata][verificationRunId]',runId);
      form.set('subscription_data[metadata][purpose]','software_payment_verification');

      const session=await stripeForm(key,'checkout/sessions',form);
      if(!session?.id||!session?.url)throw new Error('verification_checkout_session_missing');

      const {error:updateError}=await admin.from('hercules_software_payment_verification_runs')
        .update({
          checkout_session_id:String(session.id),
          evidence:{
            purpose:'controlled_live_checkout_cancel_refund',
            automatic_cancel:true,
            automatic_refund:true,
            owner_completion_required:true,
            checkout_session_created:true,
            checkout_session_expires_at:session.expires_at||null
          },
          updated_at:new Date().toISOString()
        })
        .eq('id',runId);
      if(updateError)throw updateError;

      return json({
        ok:true,
        action:'prepare_live_verification',
        run_id:runId,
        product_code:productCode,
        plan_code:planCode,
        amount_cents:expected,
        currency:'usd',
        checkout_url:String(session.url),
        charge_occurs_only_if_owner_completes_checkout:true,
        after_success:'Hercules automatically cancels the verification subscription, refunds the payment, verifies signed webhook evidence, and certifies the product payment path.'
      });
    }catch(error){
      return json({error:'prepare_live_verification_failed',detail:error instanceof Error?error.message:String(error)},502);
    }
  }

  return json({error:'unknown_action'},400);
});
