import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(U,S,{auth:{persistSession:false}});

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'content-type':'application/json',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  }
});

function stripeId(value:any){
  if(typeof value==='string')return value;
  return String(value?.id||'');
}

async function secret(kind:'access'|'signing'){
  const env=kind==='access'?Deno.env.get('STRIPE_SECRET_KEY'):Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if(env)return env;
  const column=kind==='access'?'access_secret_ref':'signing_secret_ref';
  const {data:connection}=await admin.from('hercules_provider_connections')
    .select(column)
    .eq('provider','stripe')
    .eq('status','active')
    .order('connected_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  const ref=kind==='access'?(connection as any)?.access_secret_ref:(connection as any)?.signing_secret_ref;
  if(!ref)return '';
  const {data,error}=await admin.rpc('hercules_get_secret',{p_id:ref});
  if(error)throw error;
  return String(data||'');
}

async function stripe(path:string,init:RequestInit={}){
  const key=await secret('access');
  if(!key)throw new Error('stripe_not_configured');
  const response=await fetch('https://api.stripe.com/v1/'+path,{
    ...init,
    headers:{Authorization:'Bearer '+key,...(init.headers||{})},
    signal:AbortSignal.timeout(30000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body?.error?.message||('stripe_request_failed_'+response.status));
  return body;
}

async function stripeForm(path:string,form:URLSearchParams){
  return stripe(path,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:form
  });
}

async function hmacHex(secretValue:string,payload:string){
  const key=await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretValue),
    {name:'HMAC',hash:'SHA-256'},
    false,
    ['sign']
  );
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

async function sha256(payload:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let out=0;
  for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}

async function verify(payload:string,header:string,secretValue:string){
  const parts=header.split(',').map(value=>value.trim());
  const timestamp=parts.find(value=>value.startsWith('t='))?.slice(2);
  const signatures=parts.filter(value=>value.startsWith('v1=')).map(value=>value.slice(3));
  if(!timestamp||!signatures.length)return false;
  const numeric=Number(timestamp);
  if(!Number.isFinite(numeric)||Math.abs(Date.now()/1000-numeric)>300)return false;
  const expected=await hmacHex(secretValue,timestamp+'.'+payload);
  return signatures.some(signature=>safeEqual(signature,expected));
}

function normStatus(value:any){
  const status=String(value||'incomplete');
  return ['trialing','active','past_due','canceled','paused','incomplete','incomplete_expired','unpaid'].includes(status)
    ?status
    :'incomplete';
}

async function platformPlan(code:string){
  const {data,error}=await admin.from('hercules_plans').select('*').eq('code',code).single();
  if(error)throw error;
  return data;
}

async function savePlatformSubscription(org:string,planCode:string,subscription:any){
  const periodStart=typeof subscription.current_period_start==='number'
    ?new Date(subscription.current_period_start*1000).toISOString():null;
  const periodEnd=typeof subscription.current_period_end==='number'
    ?new Date(subscription.current_period_end*1000).toISOString():null;

  const {error}=await admin.from('hercules_subscriptions').upsert({
    organization_id:org,
    plan_code:planCode,
    status:normStatus(subscription.status),
    billing_provider:'stripe',
    provider_customer_id:stripeId(subscription.customer),
    provider_subscription_id:String(subscription.id||''),
    current_period_start:periodStart,
    current_period_end:periodEnd,
    cancel_at_period_end:Boolean(subscription.cancel_at_period_end),
    updated_at:new Date().toISOString()
  },{onConflict:'organization_id'});
  if(error)throw error;

  const plan=await platformPlan(planCode);
  const rows:any[]=[];
  for(const [key,value] of Object.entries(plan.features||{})){
    rows.push({organization_id:org,feature_key:key,enabled:Boolean(value),limit_value:null,source:'plan',updated_at:new Date().toISOString()});
  }
  for(const [key,value] of Object.entries(plan.limits||{})){
    rows.push({organization_id:org,feature_key:key,enabled:true,limit_value:Number(value),source:'plan',updated_at:new Date().toISOString()});
  }
  if(rows.length){
    const {error:entitlementError}=await admin.from('hercules_entitlements').upsert(rows,{onConflict:'organization_id,feature_key'});
    if(entitlementError)throw entitlementError;
  }
}

async function softwarePlan(productCode:string,planCode:string){
  const {data,error}=await admin.from('hercules_software_product_plans')
    .select('product_code,plan_code,entitlements,candidate_monthly_price_cents')
    .eq('product_code',productCode)
    .order('candidate_monthly_price_cents');
  if(error)throw error;
  const rows=data||[];
  const selected=rows.find((row:any)=>row.plan_code===planCode);
  if(!selected)throw new Error('software_plan_not_found');

  const starter=rows.find((row:any)=>row.plan_code==='starter');
  const pro=rows.find((row:any)=>row.plan_code==='pro');
  const own=(row:any)=>Array.isArray(row?.entitlements)
    ?row.entitlements.map((value:any)=>String(value)).filter((value:string)=>value&&value!=='starter_features'&&value!=='pro_features')
    :[];

  let resolved:string[]=[];
  if(planCode==='starter')resolved=own(starter);
  if(planCode==='pro')resolved=[...own(starter),...own(pro)];
  if(planCode==='agency')resolved=[...own(starter),...own(pro),...own(selected)];
  if(!resolved.length)resolved=own(selected);

  return {...selected,resolved_entitlements:[...new Set(resolved)]};
}

async function saveSoftwareSubscription(org:string,productCode:string,planCode:string,subscription:any,eventId:string){
  const plan=await softwarePlan(productCode,planCode);
  const status=normStatus(subscription.status);
  const periodStart=typeof subscription.current_period_start==='number'
    ?new Date(subscription.current_period_start*1000).toISOString():null;
  const periodEnd=typeof subscription.current_period_end==='number'
    ?new Date(subscription.current_period_end*1000).toISOString():null;

  const {error}=await admin.from('hercules_software_subscriptions').upsert({
    organization_id:org,
    product_code:productCode,
    plan_code:planCode,
    status,
    billing_provider:'stripe',
    provider_customer_id:stripeId(subscription.customer),
    provider_subscription_id:String(subscription.id||''),
    current_period_start:periodStart,
    current_period_end:periodEnd,
    cancel_at_period_end:Boolean(subscription.cancel_at_period_end),
    metadata:{
      last_stripe_event_id:eventId,
      last_status:status
    },
    updated_at:new Date().toISOString()
  },{onConflict:'organization_id,product_code'});
  if(error)throw error;

  const entitlements=Array.isArray(plan.resolved_entitlements)?plan.resolved_entitlements:[];
  const enabled=status==='active'||status==='trialing';

  const {error:deleteError}=await admin.from('hercules_software_entitlements')
    .delete()
    .eq('organization_id',org)
    .eq('product_code',productCode);
  if(deleteError)throw deleteError;

  if(entitlements.length){
    const rows=entitlements.map((featureKey:string)=>({
      organization_id:org,
      product_code:productCode,
      feature_key:featureKey,
      enabled,
      source:'subscription',
      metadata:{plan_code:planCode,subscription_status:status},
      updated_at:new Date().toISOString()
    }));
    const {error:insertError}=await admin.from('hercules_software_entitlements').insert(rows);
    if(insertError)throw insertError;
  }
}

function softwareMetadata(obj:any){
  const metadata=obj?.metadata||{};
  return {
    organizationId:String(metadata.organizationId||''),
    softwareProductCode:String(metadata.softwareProductCode||''),
    softwarePlanCode:String(metadata.softwarePlanCode||''),
    verificationRunId:String(metadata.verificationRunId||'')
  };
}

function titanMetadata(obj:any){
  const metadata=obj?.metadata||{};
  return {
    organizationId:String(metadata.organizationId||''),
    titanProductCode:String(metadata.titanProductCode||''),
    titanVerificationRunId:String(metadata.titanVerificationRunId||'')
  };
}

async function updateVerificationRun(runId:string,patch:any){
  if(!runId)return;
  const {error}=await admin.from('hercules_software_payment_verification_runs')
    .update({...patch,updated_at:new Date().toISOString()})
    .eq('id',runId);
  if(error)throw error;
}

async function recordVerificationEvent(runId:string,event:any,payloadHash:string,evidence:any={}){
  if(!runId)return;
  const {error}=await admin.rpc('hercules_software_record_verification_event',{
    p_run_id:runId,
    p_stripe_event_id:String(event.id),
    p_event_type:String(event.type),
    p_payload_hash:payloadHash,
    p_evidence:{
      signature_verified:true,
      livemode:Boolean(event.livemode),
      ...evidence
    }
  });
  if(error)throw error;
}

async function tryCertify(runId:string){
  if(!runId)return null;
  const {data,error}=await admin.rpc('hercules_software_certify_payment_path',{p_run_id:runId});
  if(error){
    const message=String(error.message||'');
    if(message.includes('verification_identifiers_incomplete')||
       message.includes('commercial_prerequisites_not_approved')||
       message.includes('live_software_stripe_catalog_mismatch')||
       message.includes('live_mode_verification_required')){
      return {ok:false,pending:true,reason:message};
    }
    throw error;
  }
  return data;
}

async function updateTitanVerificationRun(runId:string,patch:any){
  if(!runId)return;
  const {error}=await admin.from('hercules_titan_payment_verification_runs')
    .update({...patch,updated_at:new Date().toISOString()})
    .eq('id',runId);
  if(error)throw error;
}

async function recordTitanVerificationEvent(runId:string,event:any,payloadHash:string,evidence:any={}){
  if(!runId)return;
  const {error}=await admin.rpc('hercules_titan_record_verification_event',{
    p_run_id:runId,
    p_stripe_event_id:String(event.id),
    p_event_type:String(event.type),
    p_payload_hash:payloadHash,
    p_evidence:{
      signature_verified:true,
      livemode:Boolean(event.livemode),
      ...evidence
    }
  });
  if(error)throw error;
}

async function tryCertifyTitan(runId:string){
  if(!runId)return null;
  const {data,error}=await admin.rpc('hercules_titan_certify_payment_path',{p_run_id:runId});
  if(error){
    const message=String(error.message||'');
    if(message.includes('verification_identifiers_incomplete')||
       message.includes('commercial_prerequisites_not_approved')||
       message.includes('live_titan_stripe_catalog_mismatch')||
       message.includes('live_mode_verification_required')||
       message.includes('payout_state_evidence_incomplete')){
      return {ok:false,pending:true,reason:message};
    }
    throw error;
  }
  return data;
}

async function autoRefundTitanVerification(runId:string,paymentIntentId:string){
  if(!runId||!paymentIntentId)return;

  const {data:run,error}=await admin.from('hercules_titan_payment_verification_runs')
    .select('id,status,payment_intent_id,refund_id,evidence')
    .eq('id',runId)
    .single();
  if(error)throw error;
  if(run.status==='verified'||run.refund_id||run.evidence?.refund_requested)return;

  await updateTitanVerificationRun(runId,{
    payment_intent_id:paymentIntentId,
    evidence:{...(run.evidence||{}),refund_requested:true}
  });

  const form=new URLSearchParams();
  form.set('payment_intent',paymentIntentId);
  form.set('metadata[titanVerificationRunId]',runId);
  form.set('metadata[purpose]','titan_payment_verification');
  const refund=await stripeForm('refunds',form);
  await updateTitanVerificationRun(runId,{
    refund_id:String(refund.id||'')||null,
    evidence:{...(run.evidence||{}),refund_requested:true,refund_created:true}
  });
}

async function autoCancelAndRefund(runId:string,subscriptionId:string,paymentIntentId:string){
  if(!runId||!subscriptionId||!paymentIntentId)return;

  const {data:run,error}=await admin.from('hercules_software_payment_verification_runs')
    .select('id,status,provider_subscription_id,payment_intent_id,refund_id,evidence')
    .eq('id',runId)
    .single();
  if(error)throw error;
  if(run.status==='verified')return;

  if(!run.evidence?.cancel_requested){
    await updateVerificationRun(runId,{
      provider_subscription_id:subscriptionId,
      payment_intent_id:paymentIntentId,
      evidence:{...(run.evidence||{}),cancel_requested:true}
    });
    try{
      await stripe('subscriptions/'+encodeURIComponent(subscriptionId),{method:'DELETE'});
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      if(!/canceled|No such subscription/i.test(message))throw error;
    }
  }

  const {data:fresh,error:freshError}=await admin.from('hercules_software_payment_verification_runs')
    .select('id,refund_id,evidence')
    .eq('id',runId)
    .single();
  if(freshError)throw freshError;

  if(!fresh.refund_id&&!fresh.evidence?.refund_requested){
    await updateVerificationRun(runId,{
      evidence:{...(fresh.evidence||{}),refund_requested:true}
    });
    const form=new URLSearchParams();
    form.set('payment_intent',paymentIntentId);
    form.set('metadata[verificationRunId]',runId);
    form.set('metadata[purpose]','software_payment_verification');
    const refund=await stripeForm('refunds',form);
    await updateVerificationRun(runId,{
      refund_id:String(refund.id||''),
      evidence:{...(fresh.evidence||{}),refund_requested:true,refund_created:true}
    });
  }
}

Deno.serve(async req=>{
  if(req.method==='GET'){
    const access=await secret('access');
    const signing=await secret('signing');
    return json({
      ok:true,
      service:'hercules-stripe-webhook',
      version:'5.1.0',
      access_configured:Boolean(access),
      webhook_configured:Boolean(signing),
      dedupe:'unique-receipt-first',
      payload_hash:'sha256',
      software_billing:'isolated',
      verification_events:[
        'checkout.session.completed',
        'customer.subscription.created',
        'invoice.payment_succeeded',
        'customer.subscription.deleted',
        'charge.refunded'
      ]
    });
  }
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);

  const signingSecret=await secret('signing');
  if(!signingSecret)return json({error:'webhook_not_configured'},503);

  const payload=await req.text();
  const signature=req.headers.get('stripe-signature')||'';
  if(!await verify(payload,signature,signingSecret))return json({error:'invalid_stripe_signature'},400);

  let event:any;
  try{event=JSON.parse(payload)}
  catch{return json({error:'invalid_json'},400)}

  const delivery=String(event?.id||'');
  if(!delivery)return json({error:'missing_event_id'},400);
  const payloadHash=await sha256(payload);

  const {error:receiptError}=await admin.from('hercules_webhook_receipts').insert({
    provider:'stripe',
    delivery_id:delivery,
    topic:String(event.type||''),
    signature_verified:true,
    status:'received',
    payload_hash:payloadHash,
    received_at:new Date().toISOString()
  });

  if(receiptError){
    if(String(receiptError.code)==='23505'){
      const {data:existing,error:existingError}=await admin.from('hercules_webhook_receipts')
        .select('status')
        .eq('provider','stripe')
        .eq('delivery_id',delivery)
        .single();
      if(existingError)return json({error:'receipt_read_failed'},500);
      if(existing.status==='processed')return json({received:true,duplicate:true});
      const {error:retryError}=await admin.from('hercules_webhook_receipts')
        .update({status:'received',error:null,received_at:new Date().toISOString()})
        .eq('provider','stripe')
        .eq('delivery_id',delivery);
      if(retryError)return json({error:'receipt_retry_reset_failed'},500);
    }else{
      return json({error:'receipt_write_failed'},500);
    }
  }

  let organizationId='';
  let verificationRunId='';
  let titanVerificationRunId='';

  try{
    const obj=event?.data?.object||{};
    const type=String(event.type||'');

    if(type==='checkout.session.completed'){
      const titan=titanMetadata(obj);
      const meta=softwareMetadata(obj);
      organizationId=String(obj.client_reference_id||titan.organizationId||meta.organizationId||'');
      titanVerificationRunId=titan.titanVerificationRunId;
      verificationRunId=meta.verificationRunId;

      if(titanVerificationRunId&&titan.titanProductCode==='hercules-titan-founding-access'){
        const paymentIntentId=stripeId(obj.payment_intent);
        await updateTitanVerificationRun(titanVerificationRunId,{
          checkout_session_id:String(obj.id||''),
          provider_customer_id:stripeId(obj.customer),
          payment_intent_id:paymentIntentId
        });
        await recordTitanVerificationEvent(titanVerificationRunId,event,payloadHash,{
          checkout_session_id:String(obj.id||''),
          payment_intent_id:paymentIntentId,
          amount_total:Number(obj.amount_total||0),
          payment_status:String(obj.payment_status||'')
        });
        if(paymentIntentId){
          await autoRefundTitanVerification(titanVerificationRunId,paymentIntentId);
        }
      }else if(meta.softwareProductCode&&meta.softwarePlanCode){
        const subscriptionId=stripeId(obj.subscription);
        if(organizationId&&subscriptionId){
          const subscription=await stripe('subscriptions/'+encodeURIComponent(subscriptionId));
          await saveSoftwareSubscription(
            organizationId,meta.softwareProductCode,meta.softwarePlanCode,subscription,delivery
          );
          await updateVerificationRun(verificationRunId,{
            checkout_session_id:String(obj.id||''),
            provider_customer_id:stripeId(obj.customer),
            provider_subscription_id:subscriptionId
          });
        }
        await recordVerificationEvent(verificationRunId,event,payloadHash,{
          checkout_session_id:String(obj.id||''),
          subscription_id:subscriptionId
        });
      }else{
        const planCode=String(obj.metadata?.planCode||'pro');
        const subscriptionId=stripeId(obj.subscription);
        if(organizationId&&subscriptionId){
          const subscription=await stripe('subscriptions/'+encodeURIComponent(subscriptionId));
          await savePlatformSubscription(organizationId,planCode,subscription);
        }
      }
    }

    if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(type)){
      const meta=softwareMetadata(obj);
      organizationId=meta.organizationId;
      verificationRunId=meta.verificationRunId;
      if(meta.softwareProductCode&&meta.softwarePlanCode){
        if(organizationId&&obj?.id){
          await saveSoftwareSubscription(
            organizationId,meta.softwareProductCode,meta.softwarePlanCode,obj,delivery
          );
        }
        await updateVerificationRun(verificationRunId,{
          provider_customer_id:stripeId(obj.customer),
          provider_subscription_id:String(obj.id||'')
        });
        await recordVerificationEvent(verificationRunId,event,payloadHash,{
          subscription_id:String(obj.id||''),
          subscription_status:String(obj.status||'')
        });
      }else{
        const planCode=String(obj?.metadata?.planCode||'pro');
        if(organizationId&&obj?.id)await savePlatformSubscription(organizationId,planCode,obj);
      }
    }

    if(type==='invoice.payment_succeeded'){
      const subscriptionId=stripeId(obj.subscription);
      const subscription=subscriptionId
        ?await stripe('subscriptions/'+encodeURIComponent(subscriptionId))
        :null;
      const meta=softwareMetadata(subscription);
      organizationId=meta.organizationId;
      verificationRunId=meta.verificationRunId;

      if(subscription&&meta.softwareProductCode&&meta.softwarePlanCode){
        if(organizationId){
          await saveSoftwareSubscription(
            organizationId,meta.softwareProductCode,meta.softwarePlanCode,subscription,delivery
          );
        }
        const paymentIntentId=stripeId(obj.payment_intent);
        await updateVerificationRun(verificationRunId,{
          provider_customer_id:stripeId(obj.customer),
          provider_subscription_id:subscriptionId,
          invoice_id:String(obj.id||''),
          payment_intent_id:paymentIntentId
        });
        await recordVerificationEvent(verificationRunId,event,payloadHash,{
          invoice_id:String(obj.id||''),
          payment_intent_id:paymentIntentId,
          subscription_id:subscriptionId,
          amount_paid:Number(obj.amount_paid||0)
        });

        if(verificationRunId&&paymentIntentId){
          await autoCancelAndRefund(verificationRunId,subscriptionId,paymentIntentId);
        }
      }
    }

    if(type==='charge.refunded'){
      const paymentIntentId=stripeId(obj.payment_intent);
      if(paymentIntentId){
        const [{data:titanRun},{data:softwareRun}]=await Promise.all([
          admin.from('hercules_titan_payment_verification_runs')
            .select('id')
            .eq('payment_intent_id',paymentIntentId)
            .order('created_at',{ascending:false})
            .limit(1)
            .maybeSingle(),
          admin.from('hercules_software_payment_verification_runs')
            .select('id')
            .eq('payment_intent_id',paymentIntentId)
            .order('created_at',{ascending:false})
            .limit(1)
            .maybeSingle()
        ]);
        titanVerificationRunId=String(titanRun?.id||'');
        verificationRunId=titanVerificationRunId?'':String(softwareRun?.id||'');
      }
      const refundId=String(obj.refunds?.data?.[0]?.id||'');
      if(titanVerificationRunId){
        await updateTitanVerificationRun(titanVerificationRunId,{
          charge_id:String(obj.id||'')||null,
          refund_id:refundId||null
        });
        await recordTitanVerificationEvent(titanVerificationRunId,event,payloadHash,{
          charge_id:String(obj.id||''),
          payment_intent_id:paymentIntentId,
          refund_id:refundId,
          refunded:Boolean(obj.refunded),
          amount_refunded:Number(obj.amount_refunded||0)
        });
      }else if(verificationRunId){
        await updateVerificationRun(verificationRunId,{refund_id:refundId});
        await recordVerificationEvent(verificationRunId,event,payloadHash,{
          charge_id:String(obj.id||''),
          payment_intent_id:paymentIntentId,
          refund_id:refundId,
          refunded:Boolean(obj.refunded),
          amount_refunded:Number(obj.amount_refunded||0)
        });
      }
    }

    const titanCertification=titanVerificationRunId?await tryCertifyTitan(titanVerificationRunId):null;
    const certification=verificationRunId?await tryCertify(verificationRunId):null;

    await admin.from('hercules_webhook_receipts').update({
      organization_id:organizationId||null,
      status:'processed',
      processed_at:new Date().toISOString(),
      error:null
    }).eq('provider','stripe').eq('delivery_id',delivery);

    return json({received:true,processed:true,software_verification:certification,titan_verification:titanCertification});
  }catch(error){
    await admin.from('hercules_webhook_receipts').update({
      organization_id:organizationId||null,
      status:'failed',
      error:error instanceof Error?error.message:'processing_failed',
      processed_at:new Date().toISOString()
    }).eq('provider','stripe').eq('delivery_id',delivery);
    return json({error:error instanceof Error?error.message:'processing_failed'},500);
  }
});
