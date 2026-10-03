import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=Deno.env.get('SUPABASE_ANON_KEY')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORE='sauceapproved-2.myshopify.com';
const SHOP_GID='gid://shopify/Shop/100002726208';
const SHOP_ALIASES=new Set([
  STORE,
  'azymhc-x0.myshopify.com',
  'sauceapproved-3.myshopify.com'
]);
function shopDomainAllowed(value:unknown){
  return SHOP_ALIASES.has(String(value??'').trim().toLowerCase());
}
const RECEIVER=`${U}/functions/v1/hercules-shopify-webhook`;
const STRIPE_RECEIVER=`${U}/functions/v1/hercules-stripe-webhook`;
const INTEGRATIONS_RETURN=`${U}/functions/v1/hercules-integrations`;
const STUDIO_ADS_PRODUCTS=['sauceapproved-studio','sauceapproved-ads'] as const;
const TITAN_PRODUCT_CODE='hercules-titan-founding-access';
const TITAN_PRICE_CENTS=4900;
const TITAN_LOOKUP_KEY='titan_founding_access_one_time_v1';
const SOFTWARE_PRICE_GUARD={starter:2900,pro:7900,agency:19900} as const;
const STRIPE_EVENTS=[
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded'
] as const;

const j=(body:any,status=200)=>new Response(JSON.stringify(body),{
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
    .select('organization_id,role')
    .eq('user_id',user.id)
    .eq('status','active')
    .in('role',['owner','admin'])
    .limit(1)
    .maybeSingle();

  return membership?{db,user,membership}:null;
}

async function sha256(value:string){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map(v=>v.toString(16).padStart(2,'0')).join('');
}

async function internalAuthorized(req:Request,admin:any,purpose:string){
  const supplied=req.headers.get('x-hercules-internal-key')||'';
  if(!supplied)return false;

  const {data}=await admin.from('hercules_internal_service_keys')
    .select('key_sha256,enabled')
    .eq('purpose',purpose)
    .eq('enabled',true)
    .limit(1)
    .maybeSingle();

  if(!data?.enabled||!data?.key_sha256)return false;
  return data.key_sha256===await sha256(supplied);
}

async function storeSecret(admin:any,value:string,name:string,description:string){
  const {data,error}=await admin.rpc('hercules_store_secret',{
    p_value:value,p_name:name,p_description:description
  });
  if(error)throw error;
  return String(data);
}

async function getSecret(admin:any,ref:string){
  const {data,error}=await admin.rpc('hercules_get_secret',{p_id:ref});
  if(error)throw error;
  if(!data)throw new Error('secret_unavailable');
  return String(data);
}

async function upsertConnection(admin:any,org:string,provider:string,key:string,patch:any){
  const {data,error}=await admin.from('hercules_provider_connections').upsert({
    organization_id:org,provider,account_key:key,...patch,updated_at:new Date().toISOString()
  },{onConflict:'organization_id,provider,account_key'})
    .select('id,provider,account_key,client_id,status,connected_at,last_error,metadata')
    .single();

  if(error)throw error;
  return data;
}

async function shopifyGraphql(token:string,query:string,variables:any={}){
  const response=await fetch(`https://${STORE}/admin/api/2026-07/graphql.json`,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-shopify-access-token':token
    },
    body:JSON.stringify({query,variables}),
    signal:AbortSignal.timeout(30000)
  });

  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.errors?.length){
    const error:any=new Error(
      body.errors?.map((x:any)=>x.message).join(';')||`shopify_${response.status}`
    );
    error.status=response.status;
    throw error;
  }
  return body.data;
}

async function exchangeShopifyToken(clientId:string,clientSecret:string){
  const response=await fetch(`https://${STORE}/admin/oauth/access_token`,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'client_credentials',
      client_id:clientId,
      client_secret:clientSecret
    }),
    signal:AbortSignal.timeout(30000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body.access_token){
    throw new Error(body.error_description||body.error||`token_exchange_${response.status}`);
  }
  return String(body.access_token);
}

async function stripeRequest(key:string,path:string,init:RequestInit={}){
  const response=await fetch('https://api.stripe.com/v1/'+path,{
    ...init,
    headers:{
      Authorization:`Bearer ${key}`,
      ...(init.headers||{})
    },
    signal:AbortSignal.timeout(30000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    throw new Error(body?.error?.message||`stripe_http_${response.status}`);
  }
  return body;
}

async function stripeForm(key:string,path:string,form:URLSearchParams){
  return stripeRequest(key,path,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:form
  });
}

async function ensureStripeCatalog(admin:any,key:string){
  const {data:plans,error}=await admin.from('hercules_plans')
    .select('code,name,monthly_price_cents,annual_price_cents,is_active')
    .eq('is_active',true)
    .order('code');
  if(error)throw error;
  if(!plans?.length)throw new Error('active_hercules_plan_catalog_missing');

  const products=await stripeRequest(key,'products?active=true&limit=100');
  const catalog:any[]=[];

  for(const plan of plans){
    let product=(products.data||[]).find((item:any)=>
      item?.metadata?.hercules_plan_code===plan.code
    );

    if(!product){
      const form=new URLSearchParams();
      form.set('name',`Hercules ${plan.name}`);
      form.set('metadata[hercules_plan_code]',String(plan.code));
      form.set('metadata[hercules_catalog_source]','hercules_plans');
      product=await stripeForm(key,'products',form);
      products.data=[...(products.data||[]),product];
    }

    const desired=[
      {
        billing:'monthly',
        amount:Number(plan.monthly_price_cents),
        interval:'month',
        lookupKey:`hercules_${plan.code}_monthly_v1`
      },
      {
        billing:'annual',
        amount:Number(plan.annual_price_cents),
        interval:'year',
        lookupKey:`hercules_${plan.code}_annual_v1`
      }
    ];

    const priceIds:Record<string,string>={};
    for(const target of desired){
      const priceQuery=new URLSearchParams({active:'true',limit:'10'});
      priceQuery.append('lookup_keys[]',target.lookupKey);
      const priceLookup=await stripeRequest(key,'prices?'+priceQuery.toString());
      let price=(priceLookup.data||[]).find((item:any)=>item?.lookup_key===target.lookupKey);

      if(price){
        const compatible=
          Number(price.unit_amount)===target.amount &&
          String(price.currency||'').toLowerCase()==='usd' &&
          String(price.recurring?.interval||'')===target.interval &&
          Number(price.recurring?.interval_count||1)===1 &&
          String(price.product||'')===String(product.id);
        if(!compatible)throw new Error('stripe_price_conflict:'+target.lookupKey);
      }else{
        const form=new URLSearchParams();
        form.set('currency','usd');
        form.set('unit_amount',String(target.amount));
        form.set('product',String(product.id));
        form.set('recurring[interval]',target.interval);
        form.set('recurring[interval_count]','1');
        form.set('lookup_key',target.lookupKey);
        form.set('metadata[hercules_plan_code]',String(plan.code));
        form.set('metadata[hercules_billing_period]',target.billing);
        price=await stripeForm(key,'prices',form);
      }

      priceIds[target.billing]=String(price.id);
    }

    catalog.push({
      plan_code:String(plan.code),
      product_id:String(product.id),
      monthly_price_id:priceIds.monthly,
      annual_price_id:priceIds.annual,
      monthly_price_cents:Number(plan.monthly_price_cents),
      annual_price_cents:Number(plan.annual_price_cents)
    });
  }

  return catalog;
}


async function approvedSoftwareProducts(admin:any){
  const {data,error}=await admin.from('hercules_software_commercial_approvals')
    .select('product_code,approval_type,status')
    .in('product_code',[...STUDIO_ADS_PRODUCTS])
    .in('approval_type',['pricing','terms','privacy']);
  if(error)throw error;
  return STUDIO_ADS_PRODUCTS.filter(productCode=>{
    const rows=(data||[]).filter((row:any)=>row.product_code===productCode);
    return rows.length===3&&rows.every((row:any)=>row.status==='approved');
  });
}

async function ensureSoftwareStripeCatalog(admin:any,key:string,stripeAccountId:string,livemode:boolean){
  const approved=await approvedSoftwareProducts(admin);
  if(!approved.length)return [];

  const {data:plans,error}=await admin.from('hercules_software_product_plans')
    .select('product_code,plan_code,label,candidate_monthly_price_cents')
    .in('product_code',approved)
    .order('candidate_monthly_price_cents');
  if(error)throw error;

  const products=await stripeRequest(key,'products?active=true&limit=100');
  const synced:any[]=[];

  for(const productCode of approved){
    const productPlans=(plans||[]).filter((row:any)=>row.product_code===productCode);
    if(productPlans.length!==3)throw new Error('software_plan_catalog_incomplete');

    for(const [planCode,amount] of Object.entries(SOFTWARE_PRICE_GUARD)){
      const row=productPlans.find((item:any)=>item.plan_code===planCode);
      if(!row||Number(row.candidate_monthly_price_cents)!==Number(amount)){
        throw new Error('software_plan_price_guard_mismatch');
      }
    }

    let product=(products.data||[]).find((item:any)=>
      item?.metadata?.softwareProductCode===productCode
    );

    if(!product){
      const productName=productCode==='sauceapproved-studio'?'SauceApproved Studio':'SauceApproved Ads';
      const form=new URLSearchParams();
      form.set('name',productName);
      form.set('metadata[softwareProductCode]',productCode);
      form.set('metadata[hercules_catalog_source]','hercules_software_product_plans');
      product=await stripeForm(key,'products',form);
      products.data=[...(products.data||[]),product];
    }

    for(const plan of productPlans){
      const planCode=String(plan.plan_code);
      const amount=Number(plan.candidate_monthly_price_cents);
      const lookupKey=`software_${productCode.replaceAll('-','_')}_${planCode}_monthly_v1`;
      const query=new URLSearchParams({active:'true',limit:'10'});
      query.append('lookup_keys[]',lookupKey);
      const priceLookup=await stripeRequest(key,'prices?'+query.toString());
      let price=(priceLookup.data||[]).find((item:any)=>item?.lookup_key===lookupKey);

      if(price){
        if(Number(price.unit_amount)!==amount||
           String(price.currency)!=='usd'||
           String(price.recurring?.interval)!=='month'||
           Number(price.recurring?.interval_count||1)!==1||
           String(price.product)!==String(product.id)){
          throw new Error('software_stripe_price_drift');
        }
      }else{
        const form=new URLSearchParams();
        form.set('currency','usd');
        form.set('unit_amount',String(amount));
        form.set('product',String(product.id));
        form.set('recurring[interval]','month');
        form.set('recurring[interval_count]','1');
        form.set('lookup_key',lookupKey);
        form.set('metadata[softwareProductCode]',productCode);
        form.set('metadata[softwarePlanCode]',planCode);
        form.set('metadata[hercules_catalog_source]','hercules_software_product_plans');
        price=await stripeForm(key,'prices',form);
      }

      const record={
        product_code:productCode,
        plan_code:planCode,
        stripe_account_id:stripeAccountId,
        stripe_product_id:String(product.id),
        stripe_price_id:String(price.id),
        unit_amount_cents:amount,
        currency:'usd',
        livemode,
        active:true,
        metadata:{
          softwareProductCode:productCode,
          softwarePlanCode:planCode,
          lookup_key:lookupKey
        },
        synced_at:new Date().toISOString()
      };
      const {error:catalogError}=await admin.from('hercules_software_stripe_catalog')
        .upsert(record,{onConflict:'product_code,plan_code'});
      if(catalogError)throw catalogError;
      synced.push(record);
    }
  }

  return synced;
}

async function ensureTitanStripeCatalog(admin:any,key:string,stripeAccountId:string,livemode:boolean){
  const {data:approvals,error:approvalError}=await admin.from('hercules_software_commercial_approvals')
    .select('approval_type,status')
    .eq('product_code',TITAN_PRODUCT_CODE)
    .in('approval_type',['pricing','terms','privacy']);
  if(approvalError)throw approvalError;
  const approved=(approvals||[]).length===3&&(approvals||[]).every((row:any)=>row.status==='approved');
  if(!approved)return [];

  const products=await stripeRequest(key,'products?active=true&limit=100');
  let product=(products.data||[]).find((item:any)=>item?.metadata?.titanProductCode===TITAN_PRODUCT_CODE);
  if(!product){
    const form=new URLSearchParams();
    form.set('name','Hercules Titan Founding Access');
    form.set('metadata[titanProductCode]',TITAN_PRODUCT_CODE);
    form.set('metadata[billingModel]','one_time');
    form.set('metadata[hercules_catalog_source]','hercules-titan-commercial-v1');
    product=await stripeForm(key,'products',form);
  }

  const query=new URLSearchParams({active:'true',limit:'10'});
  query.append('lookup_keys[]',TITAN_LOOKUP_KEY);
  const priceLookup=await stripeRequest(key,'prices?'+query.toString());
  let price=(priceLookup.data||[]).find((item:any)=>item?.lookup_key===TITAN_LOOKUP_KEY);
  if(price){
    if(Number(price.unit_amount)!==TITAN_PRICE_CENTS||
       String(price.currency||'').toLowerCase()!=='usd'||
       price.recurring!=null||
       String(price.product)!==String(product.id)){
      throw new Error('titan_stripe_price_drift');
    }
  }else{
    const form=new URLSearchParams();
    form.set('currency','usd');
    form.set('unit_amount',String(TITAN_PRICE_CENTS));
    form.set('product',String(product.id));
    form.set('lookup_key',TITAN_LOOKUP_KEY);
    form.set('metadata[titanProductCode]',TITAN_PRODUCT_CODE);
    form.set('metadata[billingModel]','one_time');
    form.set('metadata[hercules_catalog_source]','hercules-titan-commercial-v1');
    price=await stripeForm(key,'prices',form);
  }

  const record={
    product_code:TITAN_PRODUCT_CODE,
    stripe_account_id:stripeAccountId,
    stripe_product_id:String(product.id),
    stripe_price_id:String(price.id),
    unit_amount_cents:TITAN_PRICE_CENTS,
    currency:'usd',
    livemode,
    active:true,
    metadata:{lookup_key:TITAN_LOOKUP_KEY,billing_model:'one_time'},
    synced_at:new Date().toISOString()
  };
  const {error}=await admin.from('hercules_titan_stripe_catalog')
    .upsert(record,{onConflict:'product_code'});
  if(error)throw error;
  return [record];
}

async function activeStripeConnection(admin:any,organizationId:string){
  const {data,error}=await admin.from('hercules_provider_connections')
    .select('id,organization_id,provider,account_key,access_secret_ref,signing_secret_ref,status,connected_at,last_error,metadata,updated_at')
    .eq('organization_id',organizationId)
    .eq('provider','stripe')
    .eq('status','active')
    .not('access_secret_ref','is',null)
    .order('updated_at',{ascending:false})
    .limit(10);
  if(error)throw error;
  const rows=data||[];
  return rows.find((row:any)=>row?.metadata?.livemode===true) || rows[0] || null;
}

const SOFTWARE_PRODUCTS=['sauceapproved-studio','sauceapproved-ads','hercules-cleaner','hercules-titan-founding-access'] as const;

async function syncSoftwareProviderReady(admin:any,connection:any){
  const evidence={
    provider:'stripe',
    custody:'hercules-owned',
    stripe_account_id:String(connection.account_key||''),
    webhook_endpoint_id:String(connection.metadata?.webhook_endpoint_id||''),
    receiver:String(connection.metadata?.receiver||''),
    livemode:Boolean(connection.metadata?.livemode),
    catalog_ready:Boolean(connection.metadata?.catalog_ready),
    connected_at:connection.connected_at||null,
    verified_at:new Date().toISOString()
  };

  const verified=Boolean(
    evidence.livemode &&
    evidence.stripe_account_id &&
    evidence.webhook_endpoint_id &&
    evidence.receiver
  );
  const results:any[]=[];
  for(const productCode of SOFTWARE_PRODUCTS){
    const {data,error}=await admin.rpc('hercules_software_record_payment_gate',{
      p_product_code:productCode,
      p_gate:'payment_provider_ready',
      p_verified:verified,
      p_evidence:{...evidence,verified}
    });
    if(error)throw error;
    results.push({product_code:productCode,readiness:data});
  }
  return results;
}

async function softwareCommercialPrerequisites(admin:any,productCode:string){
  const {data,error}=await admin.from('hercules_software_commercial_approvals')
    .select('approval_type,status')
    .eq('product_code',productCode)
    .in('approval_type',['pricing','terms','privacy','payment_provider_ready','payment_path_verified']);
  if(error)throw error;
  const status=Object.fromEntries((data||[]).map((row:any)=>[row.approval_type,row.status]));
  return {
    status,
    ownerReady:['pricing','terms','privacy'].every(key=>status[key]==='approved'),
    providerReady:status.payment_provider_ready==='approved',
    paymentPathVerified:status.payment_path_verified==='approved'
  };
}

async function latestSoftwareVerificationRun(admin:any,organizationId:string,productCode:string){
  const {data,error}=await admin.from('hercules_software_payment_verification_runs')
    .select('id,product_code,plan_code,stripe_account_id,livemode,expected_amount_cents,status,checkout_session_id,provider_customer_id,provider_subscription_id,invoice_id,payment_intent_id,refund_id,evidence,created_at,updated_at,completed_at')
    .eq('organization_id',organizationId)
    .eq('product_code',productCode)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function softwarePaymentStatus(admin:any,organizationId:string){
  const connection=await activeStripeConnection(admin,organizationId);
  const products:any[]=[];
  for(const productCode of STUDIO_ADS_PRODUCTS){
    const prerequisites=await softwareCommercialPrerequisites(admin,productCode);
    const {data:catalog,error:catalogError}=await admin.from('hercules_software_stripe_catalog')
      .select('product_code,plan_code,stripe_account_id,stripe_product_id,stripe_price_id,unit_amount_cents,currency,livemode,active,synced_at')
      .eq('product_code',productCode)
      .order('unit_amount_cents');
    if(catalogError)throw catalogError;
    products.push({
      product_code:productCode,
      prerequisites,
      catalog:catalog||[],
      latest_run:await latestSoftwareVerificationRun(admin,organizationId,productCode)
    });
  }
  return {
    ok:true,
    service:'hercules-provider-connect',
    payment_verifier:'embedded-v1',
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

async function latestTitanVerificationRun(admin:any,organizationId:string){
  const {data,error}=await admin.from('hercules_titan_payment_verification_runs')
    .select('id,organization_id,product_code,stripe_account_id,livemode,expected_amount_cents,status,checkout_session_id,provider_customer_id,payment_intent_id,charge_id,refund_id,balance_transaction_id,evidence,created_at,updated_at,completed_at')
    .eq('organization_id',organizationId)
    .eq('product_code',TITAN_PRODUCT_CODE)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function titanPaymentStatus(admin:any,organizationId:string){
  const connection=await activeStripeConnection(admin,organizationId);
  const prerequisites=await softwareCommercialPrerequisites(admin,TITAN_PRODUCT_CODE);
  const {data:catalog,error}=await admin.from('hercules_titan_stripe_catalog')
    .select('product_code,stripe_account_id,stripe_product_id,stripe_price_id,unit_amount_cents,currency,livemode,active,synced_at')
    .eq('product_code',TITAN_PRODUCT_CODE)
    .maybeSingle();
  if(error)throw error;
  return {
    ok:true,
    service:'hercules-provider-connect',
    payment_verifier:'titan-one-time-v1',
    mode:'live_one_time_refund_verification',
    stripe:connection?{
      status:connection.status,
      account_key:connection.account_key,
      livemode:Boolean(connection.metadata?.livemode),
      connected_at:connection.connected_at
    }:{status:'not_connected'},
    product_code:TITAN_PRODUCT_CODE,
    amount_cents:TITAN_PRICE_CENTS,
    prerequisites,
    catalog:catalog||null,
    latest_run:await latestTitanVerificationRun(admin,organizationId)
  };
}

async function reconcileTitanVerificationRun(admin:any,run:any,key:string,account:any){
  if(!run?.id||run.status==='verified')return run;
  let current=run;

  if(current.payment_intent_id){
    const charges=await stripeRequest(
      key,
      'charges?payment_intent='+encodeURIComponent(String(current.payment_intent_id))+'&limit=1'
    );
    const charge=(charges.data||[])[0]||null;
    const balanceTransactionId=String(charge?.balance_transaction||current.balance_transaction_id||'');
    let balanceTransaction:any=null;
    if(balanceTransactionId){
      balanceTransaction=await stripeRequest(key,'balance_transactions/'+encodeURIComponent(balanceTransactionId));
    }

    const payoutStateVerified=Boolean(
      account?.charges_enabled===true &&
      account?.payouts_enabled===true &&
      charge?.paid===true &&
      balanceTransaction?.id &&
      String(balanceTransaction.currency||'').toLowerCase()==='usd'
    );

    const evidence={
      ...(current.evidence||{}),
      payout_state:{
        charges_enabled:Boolean(account?.charges_enabled),
        payouts_enabled:Boolean(account?.payouts_enabled),
        charge_paid:Boolean(charge?.paid),
        balance_transaction_id:balanceTransactionId||null,
        balance_status:balanceTransaction?.status||null,
        available_on:balanceTransaction?.available_on||null,
        amount:Number(balanceTransaction?.amount||0),
        fee:Number(balanceTransaction?.fee||0),
        net:Number(balanceTransaction?.net||0),
        currency:balanceTransaction?.currency||null,
        verified:payoutStateVerified
      }
    };
    const {data,error}=await admin.from('hercules_titan_payment_verification_runs')
      .update({
        charge_id:String(charge?.id||current.charge_id||'')||null,
        balance_transaction_id:balanceTransactionId||null,
        evidence,
        updated_at:new Date().toISOString()
      })
      .eq('id',current.id)
      .select('*')
      .single();
    if(error)throw error;
    current=data;

    if(payoutStateVerified&&balanceTransactionId){
      const {error:eventError}=await admin.rpc('hercules_titan_record_verification_event',{
        p_run_id:String(current.id),
        p_stripe_event_id:'titan-payout-state:'+String(current.id)+':'+balanceTransactionId,
        p_event_type:'titan.payout_state_verified',
        p_payload_hash:null,
        p_evidence:{
          charges_enabled:true,
          payouts_enabled:true,
          charge_paid:true,
          balance_transaction_id:balanceTransactionId,
          balance_status:balanceTransaction?.status||null,
          available_on:balanceTransaction?.available_on||null,
          amount:Number(balanceTransaction?.amount||0),
          fee:Number(balanceTransaction?.fee||0),
          net:Number(balanceTransaction?.net||0),
          currency:String(balanceTransaction?.currency||'')
        }
      });
      if(eventError)throw eventError;
    }
  }

  const {data:certification,error:certificationError}=await admin.rpc(
    'hercules_titan_certify_payment_path',
    {p_run_id:String(current.id)}
  );
  if(certificationError){
    const message=String(certificationError.message||'');
    if(!message.includes('verification_identifiers_incomplete')&&
       !message.includes('commercial_prerequisites_not_approved')&&
       !message.includes('live_titan_stripe_catalog_mismatch')&&
       !message.includes('live_mode_verification_required')&&
       !message.includes('payout_state_evidence_incomplete')){
      throw certificationError;
    }
  }

  const fresh=await latestTitanVerificationRun(admin,String(current.organization_id));
  return {...fresh,certification:certification||null};
}

async function reconcileSoftwareVerificationRun(admin:any,run:any,key:string){
  if(!run?.id||run.status==='verified')return run;
  let current=run;

  if(current.provider_subscription_id&&!current.evidence?.cancel_requested){
    try{
      await stripeRequest(key,'subscriptions/'+encodeURIComponent(String(current.provider_subscription_id)),{method:'DELETE'});
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      if(!/canceled|No such subscription/i.test(message))throw error;
    }
    const evidence={...(current.evidence||{}),cancel_requested:true,reconcile_cancel:true};
    const {data,error}=await admin.from('hercules_software_payment_verification_runs')
      .update({evidence,updated_at:new Date().toISOString()})
      .eq('id',current.id)
      .select('*')
      .single();
    if(error)throw error;
    current=data;
  }

  if(current.payment_intent_id&&!current.refund_id&&!current.evidence?.refund_requested){
    const form=new URLSearchParams();
    form.set('payment_intent',String(current.payment_intent_id));
    form.set('metadata[verificationRunId]',String(current.id));
    form.set('metadata[purpose]','software_payment_verification');
    const refund=await stripeForm(key,'refunds',form);
    const evidence={...(current.evidence||{}),refund_requested:true,reconcile_refund:true};
    const {data,error}=await admin.from('hercules_software_payment_verification_runs')
      .update({
        refund_id:String(refund.id||''),
        evidence,
        updated_at:new Date().toISOString()
      })
      .eq('id',current.id)
      .select('*')
      .single();
    if(error)throw error;
    current=data;
  }

  const {data:certification,error:certificationError}=await admin.rpc(
    'hercules_software_certify_payment_path',
    {p_run_id:String(current.id)}
  );
  if(certificationError){
    const message=String(certificationError.message||'');
    if(!message.includes('verification_identifiers_incomplete')&&
       !message.includes('commercial_prerequisites_not_approved')&&
       !message.includes('live_software_stripe_catalog_mismatch')&&
       !message.includes('live_mode_verification_required')){
      throw certificationError;
    }
  }

  const {data:fresh,error:freshError}=await admin.from('hercules_software_payment_verification_runs')
    .select('id,product_code,plan_code,stripe_account_id,livemode,expected_amount_cents,status,checkout_session_id,provider_customer_id,provider_subscription_id,invoice_id,payment_intent_id,refund_id,evidence,created_at,updated_at,completed_at')
    .eq('id',current.id)
    .single();
  if(freshError)throw freshError;
  return {...fresh,certification:certification||null};
}

async function activeShopifyConnection(admin:any,organizationId?:string){
  let query=admin.from('hercules_provider_connections')
    .select('id,organization_id,provider,account_key,client_id,secret_ref,access_secret_ref,status,connected_at,last_error,metadata,updated_at')
    .eq('provider','shopify')
    .eq('account_key',STORE)
    .eq('status','active')
    .not('access_secret_ref','is',null)
    .order('updated_at',{ascending:false})
    .limit(1);

  if(organizationId)query=query.eq('organization_id',organizationId);

  const {data,error}=await query.maybeSingle();
  if(error)throw error;
  return data;
}

async function shopifyToken(admin:any,connection:any){
  let token=await getSecret(admin,String(connection.access_secret_ref));

  try{
    await shopifyGraphql(token,'query HerculesShopifyTokenProbe{shop{id}}');
    return token;
  }catch(error){
    if(Number((error as any)?.status)!==401||!connection.client_id||!connection.secret_ref){
      throw error;
    }
  }

  const clientSecret=await getSecret(admin,String(connection.secret_ref));
  token=await exchangeShopifyToken(String(connection.client_id),clientSecret);
  const accessRef=await storeSecret(
    admin,
    token,
    `hercules_shopify_access_${connection.organization_id}_${Date.now()}`,
    'Refreshed Hercules Shopify access token.'
  );

  const {error}=await admin.from('hercules_provider_connections')
    .update({
      access_secret_ref:accessRef,
      last_error:null,
      updated_at:new Date().toISOString()
    })
    .eq('id',connection.id);

  if(error)throw error;
  return token;
}

async function observeShopifyDomains(admin:any,organizationId?:string){
  const connection=await activeShopifyConnection(admin,organizationId);
  if(!connection){
    return {ok:true,status:'waiting_provider_authorization',store:STORE,shopGid:SHOP_GID};
  }

  const token=await shopifyToken(admin,connection);
  const data=await shopifyGraphql(token,`
    query HerculesShopifyDomainSnapshot{
      shop{
        id
        myshopifyDomain
        primaryDomain{id host url sslEnabled}
        domains{id host url sslEnabled}
      }
    }
  `);

  const shop=data?.shop;
  if(!shop
    || String(shop.id)!==SHOP_GID
    || !shopDomainAllowed(shop.myshopifyDomain)){
    throw new Error('shopify_production_shop_mismatch');
  }

  const domains=(Array.isArray(shop.domains)?shop.domains:[]).map((domain:any)=>({
    id:String(domain.id||''),
    host:String(domain.host||'').toLowerCase(),
    sslEnabled:Boolean(domain.sslEnabled)
  }));

  const primary=shop.primaryDomain||{};
  const {data:observation,error}=await admin.rpc('hercules_shopify_domain_observe',{
    p_shop_gid:SHOP_GID,
    p_primary_domain_id:String(primary.id||''),
    p_primary_host:String(primary.host||'').toLowerCase(),
    p_primary_ssl_enabled:Boolean(primary.sslEnabled),
    p_domains:domains,
    p_source:'hercules-provider-connect'
  });
  if(error)throw error;

  await admin.from('hercules_provider_connections').update({
    last_error:null,
    metadata:{
      ...(connection.metadata||{}),
      shop_gid:SHOP_GID,
      last_domain_observed_at:new Date().toISOString(),
      current_primary_host:String(primary.host||'').toLowerCase(),
      intended_domain_present:domains.some((domain:any)=>domain.host==='sauceapproved.com')
    },
    updated_at:new Date().toISOString()
  }).eq('id',connection.id);

  return {ok:true,status:'observed',store:STORE,shopGid:SHOP_GID,observation};
}


async function storedLaunchReadiness(admin:any){
  const {data,error}=await admin.rpc('hercules_shopify_launch_readiness_status');
  if(error)throw error;
  return data;
}

async function observeShopifyLaunch(admin:any,organizationId?:string){
  const connection=await activeShopifyConnection(admin,organizationId);
  if(!connection){
    return {
      ok:true,
      status:'stored_without_provider_authorization',
      store:STORE,
      shopGid:SHOP_GID,
      readiness:await storedLaunchReadiness(admin)
    };
  }

  const token=await shopifyToken(admin,connection);
  const data=await shopifyGraphql(token,`
    query HerculesShopifyLaunchReadiness{
      shop{
        id
        myshopifyDomain
        plan{publicDisplayName partnerDevelopment shopifyPlus}
      }
      themes(first:20,roles:[MAIN]){
        nodes{id name role processing processingFailed updatedAt}
      }
      product(id:"gid://shopify/Product/10258238406976"){
        id
        title
        handle
        status
        vendor
        publishedAt
        onlineStoreUrl
        variantsCount{count}
        variants(first:100){nodes{id availableForSale inventoryPolicy}}
        mediaCount{count}
        resourcePublicationsV2(first:20,onlyPublished:true){
          nodes{
            isPublished
            publication{
              id
              catalog{id title status}
            }
          }
        }
      }
      collections(first:50){
        nodes{
          id
          title
          handle
          productsCount{count}
          resourcePublicationsCount(onlyPublished:true){count}
        }
      }
      menus(first:20){
        nodes{
          id
          title
          handle
          isDefault
          items{id title type url}
        }
      }
    }
  `);

  if(!data?.shop
    || String(data.shop.id)!==SHOP_GID
    || !shopDomainAllowed(data.shop.myshopifyDomain)){
    throw new Error('shopify_launch_production_shop_mismatch');
  }

  const theme=(data.themes?.nodes||[]).find((item:any)=>String(item.role)==='MAIN')||null;
  const product=data.product||null;
  const variantNodes=Array.isArray(product?.variants?.nodes)?product.variants.nodes:[];
  const sellableVariantsCount=variantNodes.filter((variant:any)=>Boolean(variant?.availableForSale)).length;
  const continueSellingVariantsCount=variantNodes.filter((variant:any)=>String(variant?.inventoryPolicy||'')==='CONTINUE').length;
  const publicationTitles=(product?.resourcePublicationsV2?.nodes||[])
    .filter((item:any)=>Boolean(item.isPublished))
    .map((item:any)=>String(item?.publication?.catalog?.title||'').toLowerCase());

  const collectionNodes=Array.isArray(data.collections?.nodes)?data.collections.nodes:[];
  const collection=(handle:string)=>{
    const item=collectionNodes.find((node:any)=>String(node.handle)===handle);
    return {
      id:String(item?.id||''),
      title:String(item?.title||''),
      productsCount:Number(item?.productsCount?.count||0),
      publicationsCount:Number(item?.resourcePublicationsCount?.count||0)
    };
  };

  const menuNodes=Array.isArray(data.menus?.nodes)?data.menus.nodes:[];
  const menu=(handle:string)=>{
    const item=menuNodes.find((node:any)=>String(node.handle)===handle);
    return {
      id:String(item?.id||''),
      isDefault:Boolean(item?.isDefault),
      items:(Array.isArray(item?.items)?item.items:[]).map((x:any)=>String(x.title||'')).filter(Boolean)
    };
  };

  const snapshot={
    shopGid:SHOP_GID,
    plan:{
      publicDisplayName:String(data.shop?.plan?.publicDisplayName||''),
      partnerDevelopment:Boolean(data.shop?.plan?.partnerDevelopment),
      shopifyPlus:Boolean(data.shop?.plan?.shopifyPlus)
    },
    theme:{
      id:String(theme?.id||''),
      name:String(theme?.name||''),
      role:String(theme?.role||''),
      processing:Boolean(theme?.processing),
      processingFailed:Boolean(theme?.processingFailed)
    },
    product:{
      id:String(product?.id||''),
      title:String(product?.title||''),
      handle:String(product?.handle||''),
      status:String(product?.status||''),
      vendor:String(product?.vendor||''),
      variantsCount:Number(product?.variantsCount?.count||0),
      sellableVariantsCount,
      continueSellingVariantsCount,
      mediaCount:Number(product?.mediaCount?.count||0),
      publishedAt:product?.publishedAt||null,
      onlineStoreUrl:product?.onlineStoreUrl||null
    },
    channels:{
      onlineStore:publicationTitles.some((title:string)=>title.includes('for online store')),
      shop:publicationTitles.some((title:string)=>/for shop$/.test(title)),
      googleYoutube:publicationTitles.some((title:string)=>title.includes('google & youtube'))
    },
    collections:{
      launchDrop:collection('sauceapproved-launch-drop'),
      hoodies:collection('sauceapproved-hoodies'),
      apparel:collection('sauceapproved-apparel')
    },
    menus:{
      main:menu('main-menu'),
      footer:menu('footer')
    }
  };

  const {data:readiness,error}=await admin.rpc('hercules_shopify_launch_readiness_observe',{
    p_snapshot:snapshot,
    p_source:'hercules-provider-connect'
  });
  if(error)throw error;

  await admin.from('hercules_provider_connections').update({
    last_error:null,
    metadata:{
      ...(connection.metadata||{}),
      last_launch_readiness_at:new Date().toISOString(),
      launch_readiness_stage:readiness?.stage||null
    },
    updated_at:new Date().toISOString()
  }).eq('id',connection.id);

  return {ok:true,status:'observed',store:STORE,shopGid:SHOP_GID,readiness};
}

Deno.serve(async req=>{
  if(req.method==='GET'){
    return j({
      ok:true,
      service:'hercules-provider-connect',
      version:'1.5.0',
      providers:['shopify','stripe'],
      store:STORE,
      shopGid:SHOP_GID,
      domainMonitor:true,
      launchReadinessMonitor:true
    });
  }

  if(req.method!=='POST')return j({error:'method_not_allowed'},405);

  const admin=createClient(U,S,{auth:{persistSession:false}});

  if(req.headers.get('x-hercules-internal-key')){
    const body=await req.json().catch(()=>({}));
    const internalAction=String(body.action||'');
    const purpose=internalAction==='monitor_shopify_domain'
      ? 'shopify-domain-monitor'
      : internalAction==='monitor_shopify_launch'
        ? 'shopify-launch-readiness'
        : '';

    if(!purpose)return j({error:'internal_action_not_allowed'},400);
    if(!await internalAuthorized(req,admin,purpose))return j({error:'unauthorized'},401);

    try{
      if(internalAction==='monitor_shopify_domain'){
        return j(await observeShopifyDomains(admin));
      }
      return j(await observeShopifyLaunch(admin));
    }catch(error){
      return j({
        error:internalAction==='monitor_shopify_domain'
          ? 'shopify_domain_monitor_failed'
          : 'shopify_launch_readiness_monitor_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
    }
  }

  const identity=await ownerAuth(req);
  if(!identity)return j({error:'owner_or_admin_required'},403);

  const body=await req.json().catch(()=>({}));
  const action=String(body.action||'status');
  const org=identity.membership.organization_id;

  if(action==='status'){
    const {data}=await admin.from('hercules_provider_connections')
      .select('provider,account_key,status,connected_at,last_error,metadata')
      .eq('organization_id',org);
    return j({connections:data||[]});
  }

  if(action==='shopify_launch_status'){
    try{
      return j(await observeShopifyLaunch(admin,org));
    }catch(error){
      const stored=await storedLaunchReadiness(admin).catch(()=>null);
      return j({
        error:'shopify_launch_status_failed',
        detail:error instanceof Error?error.message:String(error),
        stored
      },502);
    }
  }

  if(action==='storefront_smoke_status'){
    try{
      const {data,error}=await admin.rpc('hercules_storefront_smoke_status');
      if(error)throw error;
      return j({ok:true,smoke:data});
    }catch(error){
      return j({
        error:'storefront_smoke_status_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
    }
  }

  if(action==='storefront_smoke_run'){
    try{
      const {data,error}=await admin.rpc('hercules_storefront_smoke_submit');
      if(error)throw error;
      return j({ok:true,queued:data!==null,request_id:data??null});
    }catch(error){
      return j({
        error:'storefront_smoke_run_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
    }
  }

  if(action==='shopify_domain_status'){
    try{
      return j(await observeShopifyDomains(admin,org));
    }catch(error){
      return j({
        error:'shopify_domain_status_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
    }
  }

  if(action==='configure_shopify'){
    try{
      const clientId=String(body.client_id||'').trim();
      const clientSecret=String(body.client_secret||'').trim();

      if(!clientId||!clientSecret){
        return j({error:'client_id_and_client_secret_required'},400);
      }
      if(clientId.length>2048||clientSecret.length>4096){
        return j({error:'shopify_credentials_too_long'},400);
      }

      const accessToken=await exchangeShopifyToken(clientId,clientSecret);
      const app=await shopifyGraphql(
        accessToken,
        'query HerculesShopifyIdentity{shop{id name myshopifyDomain}}'
      );

      if(String(app.shop.id)!==SHOP_GID
        || !shopDomainAllowed(app.shop.myshopifyDomain)){
        throw new Error('shop_mismatch');
      }

      const secretRef=await storeSecret(
        admin,clientSecret,`hercules_shopify_client_secret_${org}`,
        'Hercules Shopify client secret.'
      );
      const accessRef=await storeSecret(
        admin,accessToken,`hercules_shopify_access_${org}`,
        'Hercules Shopify access token.'
      );

      const existing=(await shopifyGraphql(
        accessToken,
        'query HerculesShopifyWebhooks{webhookSubscriptions(first:100){nodes{id topic uri}}}'
      )).webhookSubscriptions.nodes||[];

      const topics=['ORDERS_CREATE','ORDERS_PAID','PRODUCTS_UPDATE','REFUNDS_CREATE','DOMAINS_CREATE','DOMAINS_UPDATE','DOMAINS_DESTROY'];
      const created:string[]=[];

      for(const topic of topics){
        if(existing.some((item:any)=>item.topic===topic&&item.uri===RECEIVER))continue;

        const out=(await shopifyGraphql(accessToken,`
          mutation HerculesShopifyWebhook($topic:WebhookSubscriptionTopic!,$input:WebhookSubscriptionInput!){
            webhookSubscriptionCreate(topic:$topic,webhookSubscription:$input){
              webhookSubscription{id topic uri}
              userErrors{message}
            }
          }
        `,{topic,input:{uri:RECEIVER,format:'JSON'}})).webhookSubscriptionCreate;

        if(out.userErrors?.length){
          throw new Error(out.userErrors.map((item:any)=>item.message).join(';'));
        }
        created.push(out.webhookSubscription.topic);
      }

      const connection=await upsertConnection(admin,org,'shopify',STORE,{
        client_id:clientId,
        secret_ref:secretRef,
        access_secret_ref:accessRef,
        signing_secret_ref:secretRef,
        status:'active',
        connected_at:new Date().toISOString(),
        last_error:null,
        metadata:{
          receiver:RECEIVER,
          topics,
          created,
          shop_gid:SHOP_GID
        }
      });

      const domain=await observeShopifyDomains(admin,org);
      let launchReadiness:any=null;
      try{
        launchReadiness=await observeShopifyLaunch(admin,org);
      }catch(error){
        launchReadiness={
          ok:false,
          error:'launch_readiness_observation_failed',
          detail:error instanceof Error?error.message:String(error)
        };
      }
      return j({ok:true,connection,created_topics:created,domain,launchReadiness});
    }catch(error){
      return j({
        error:'shopify_connect_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
    }
  }

  if(action==='titan_payment_status'){
    if(String(identity.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      return j(await titanPaymentStatus(admin,org));
    }catch(error){
      return j({error:'titan_payment_status_failed',detail:error instanceof Error?error.message:String(error)},500);
    }
  }

  if(action==='prepare_titan_payment_verification'){
    if(String(identity.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      const prerequisites=await softwareCommercialPrerequisites(admin,TITAN_PRODUCT_CODE);
      if(!prerequisites.ownerReady)return j({error:'owner_approvals_required'},409);
      if(!prerequisites.providerReady)return j({error:'stripe_provider_required'},409);
      if(prerequisites.paymentPathVerified)return j({error:'payment_path_already_verified'},409);

      const connection=await activeStripeConnection(admin,org);
      if(!connection?.access_secret_ref)return j({error:'stripe_provider_required'},409);
      if(connection.metadata?.livemode!==true)return j({error:'live_stripe_required'},409);
      const key=await getSecret(admin,String(connection.access_secret_ref));
      const account=await stripeRequest(key,'account');
      if(!account?.id||String(account.id)!==String(connection.account_key)){
        return j({error:'stripe_account_identity_mismatch'},409);
      }
      if(account.charges_enabled!==true||account.payouts_enabled!==true){
        return j({error:'stripe_account_payout_state_not_ready'},409);
      }

      const titanCatalog=await ensureTitanStripeCatalog(admin,key,String(account.id),true);
      const catalog=titanCatalog[0]||null;
      if(!catalog||Number(catalog.unit_amount_cents)!==TITAN_PRICE_CENTS||catalog.livemode!==true){
        return j({error:'titan_stripe_catalog_required'},409);
      }

      const {data:run,error:runError}=await admin.from('hercules_titan_payment_verification_runs')
        .insert({
          organization_id:org,
          product_code:TITAN_PRODUCT_CODE,
          stripe_account_id:String(account.id),
          livemode:true,
          expected_amount_cents:TITAN_PRICE_CENTS,
          status:'prepared',
          started_by:identity.user.id,
          evidence:{
            purpose:'controlled_live_titan_checkout_refund',
            billing_model:'one_time',
            automatic_refund:true,
            owner_completion_required:true
          }
        })
        .select('id')
        .single();
      if(runError)throw runError;

      const runId=String(run.id);
      const form=new URLSearchParams();
      form.set('mode','payment');
      form.set('payment_method_types[0]','card');
      form.set('line_items[0][price]',String(catalog.stripe_price_id));
      form.set('line_items[0][quantity]','1');
      form.set('client_reference_id',String(org));
      if(identity.user.email)form.set('customer_email',String(identity.user.email));
      form.set('success_url',INTEGRATIONS_RETURN+'?titan_payment_verify=success&session_id={CHECKOUT_SESSION_ID}');
      form.set('cancel_url',INTEGRATIONS_RETURN+'?titan_payment_verify=cancelled');
      form.set('metadata[organizationId]',String(org));
      form.set('metadata[titanProductCode]',TITAN_PRODUCT_CODE);
      form.set('metadata[titanVerificationRunId]',runId);
      form.set('metadata[purpose]','titan_payment_verification');
      form.set('payment_intent_data[metadata][organizationId]',String(org));
      form.set('payment_intent_data[metadata][titanProductCode]',TITAN_PRODUCT_CODE);
      form.set('payment_intent_data[metadata][titanVerificationRunId]',runId);
      form.set('payment_intent_data[metadata][purpose]','titan_payment_verification');

      const session=await stripeForm(key,'checkout/sessions',form);
      if(!session?.id||!session?.url)throw new Error('titan_verification_checkout_session_missing');

      const {error:updateError}=await admin.from('hercules_titan_payment_verification_runs')
        .update({
          checkout_session_id:String(session.id),
          evidence:{
            purpose:'controlled_live_titan_checkout_refund',
            billing_model:'one_time',
            automatic_refund:true,
            owner_completion_required:true,
            checkout_session_created:true,
            checkout_session_expires_at:session.expires_at||null
          },
          updated_at:new Date().toISOString()
        })
        .eq('id',runId);
      if(updateError)throw updateError;

      return j({
        ok:true,
        action:'prepare_titan_payment_verification',
        run_id:runId,
        product_code:TITAN_PRODUCT_CODE,
        amount_cents:TITAN_PRICE_CENTS,
        currency:'usd',
        billing_model:'one_time',
        checkout_url:String(session.url),
        charge_occurs_only_if_owner_completes_checkout:true,
        after_success:'Hercules automatically refunds the verification payment, verifies signed webhook evidence and Stripe payout state, then certifies only the Titan payment path.'
      });
    }catch(error){
      return j({error:'prepare_titan_payment_verification_failed',detail:error instanceof Error?error.message:String(error)},502);
    }
  }

  if(action==='reconcile_titan_payment_verification'){
    if(String(identity.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      const connection=await activeStripeConnection(admin,org);
      if(!connection?.access_secret_ref)return j({error:'stripe_provider_required'},409);
      if(connection.metadata?.livemode!==true)return j({error:'live_stripe_required'},409);
      const key=await getSecret(admin,String(connection.access_secret_ref));
      const account=await stripeRequest(key,'account');
      if(!account?.id||String(account.id)!==String(connection.account_key)){
        return j({error:'stripe_account_identity_mismatch'},409);
      }
      const run=await latestTitanVerificationRun(admin,org);
      if(!run)return j({error:'verification_run_not_found'},404);
      return j({
        ok:true,
        product_code:TITAN_PRODUCT_CODE,
        run:await reconcileTitanVerificationRun(admin,run,key,account)
      });
    }catch(error){
      return j({error:'reconcile_titan_payment_verification_failed',detail:error instanceof Error?error.message:String(error)},502);
    }
  }

  if(action==='software_payment_status'){
    if(String(identity.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      return j(await softwarePaymentStatus(admin,org));
    }catch(error){
      return j({error:'software_payment_status_failed',detail:error instanceof Error?error.message:String(error)},500);
    }
  }

  if(action==='prepare_software_payment_verification'){
    if(String(identity.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      const productCode=String(body.product_code||'');
      const planCode=String(body.plan_code||'starter');
      if(!STUDIO_ADS_PRODUCTS.includes(productCode as any))return j({error:'valid_product_code_required'},400);
      if(planCode!=='starter')return j({error:'verification_uses_starter_plan_only'},400);

      const prerequisites=await softwareCommercialPrerequisites(admin,productCode);
      if(!prerequisites.ownerReady)return j({error:'owner_approvals_required'},409);
      if(!prerequisites.providerReady)return j({error:'stripe_provider_required'},409);
      if(prerequisites.paymentPathVerified)return j({error:'payment_path_already_verified'},409);

      const connection=await activeStripeConnection(admin,org);
      if(!connection?.access_secret_ref)return j({error:'stripe_provider_required'},409);
      if(connection.metadata?.livemode!==true)return j({error:'live_stripe_required'},409);

      const key=await getSecret(admin,String(connection.access_secret_ref));
      const account=await stripeRequest(key,'account');
      if(!account?.id||String(account.id)!==String(connection.account_key)){
        return j({error:'stripe_account_identity_mismatch'},409);
      }

      const {data:catalog,error:catalogError}=await admin.from('hercules_software_stripe_catalog')
        .select('product_code,plan_code,stripe_account_id,stripe_price_id,unit_amount_cents,currency,livemode,active')
        .eq('product_code',productCode)
        .eq('plan_code',planCode)
        .eq('active',true)
        .single();
      if(catalogError||!catalog)return j({error:'software_stripe_catalog_required'},409);

      const expected=SOFTWARE_PRICE_GUARD[planCode as keyof typeof SOFTWARE_PRICE_GUARD];
      if(Number(catalog.unit_amount_cents)!==expected||
         catalog.currency!=='usd'||
         catalog.livemode!==true||
         String(catalog.stripe_account_id)!==String(account.id)){
        return j({error:'software_stripe_catalog_mismatch'},409);
      }

      const {data:run,error:runError}=await admin.from('hercules_software_payment_verification_runs')
        .insert({
          organization_id:org,
          product_code:productCode,
          plan_code:planCode,
          stripe_account_id:String(account.id),
          livemode:true,
          expected_amount_cents:expected,
          status:'prepared',
          started_by:identity.user.id,
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
      form.set('client_reference_id',String(org));
      if(identity.user.email)form.set('customer_email',String(identity.user.email));
      form.set('success_url',INTEGRATIONS_RETURN+'?software_payment_verify=success&session_id={CHECKOUT_SESSION_ID}');
      form.set('cancel_url',INTEGRATIONS_RETURN+'?software_payment_verify=cancelled');
      form.set('metadata[organizationId]',String(org));
      form.set('metadata[softwareProductCode]',productCode);
      form.set('metadata[softwarePlanCode]',planCode);
      form.set('metadata[verificationRunId]',runId);
      form.set('metadata[purpose]','software_payment_verification');
      form.set('subscription_data[metadata][organizationId]',String(org));
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

      return j({
        ok:true,
        action:'prepare_software_payment_verification',
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
      return j({error:'prepare_software_payment_verification_failed',detail:error instanceof Error?error.message:String(error)},502);
    }
  }

  if(action==='reconcile_software_payment_verification'){
    if(String(identity.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      const productCode=String(body.product_code||'');
      if(!STUDIO_ADS_PRODUCTS.includes(productCode as any))return j({error:'valid_product_code_required'},400);
      const connection=await activeStripeConnection(admin,org);
      if(!connection?.access_secret_ref)return j({error:'stripe_provider_required'},409);
      if(connection.metadata?.livemode!==true)return j({error:'live_stripe_required'},409);
      const key=await getSecret(admin,String(connection.access_secret_ref));
      const run=await latestSoftwareVerificationRun(admin,org,productCode);
      if(!run)return j({error:'verification_run_not_found'},404);
      return j({ok:true,product_code:productCode,run:await reconcileSoftwareVerificationRun(admin,run,key)});
    }catch(error){
      return j({error:'reconcile_software_payment_verification_failed',detail:error instanceof Error?error.message:String(error)},502);
    }
  }

  if(action==='configure_stripe'){
    try{
      const key=String(body.secret_key||'').trim();
      if(!key.startsWith('sk_'))return j({error:'valid_stripe_secret_key_required'},400);

      const account=await stripeRequest(key,'account');
      if(!account?.id)throw new Error('stripe_account_identity_missing');

      const catalog=await ensureStripeCatalog(admin,key);

      const existingConnection=await admin.from('hercules_provider_connections')
        .select('signing_secret_ref')
        .eq('organization_id',org)
        .eq('provider','stripe')
        .eq('account_key',String(account.id))
        .maybeSingle();

      const list=await stripeRequest(key,'webhook_endpoints?limit=100');
      let endpoint=(list.data||[]).find((item:any)=>item.url===STRIPE_RECEIVER);
      let signingSecret='';
      let signingRef=existingConnection.data?.signing_secret_ref||null;

      if(!endpoint){
        const form=new URLSearchParams();
        form.set('url',STRIPE_RECEIVER);
        for(const event of STRIPE_EVENTS)form.append('enabled_events[]',event);
        endpoint=await stripeForm(key,'webhook_endpoints',form);
        signingSecret=String(endpoint.secret||'');
      }else{
        const form=new URLSearchParams();
        for(const event of STRIPE_EVENTS)form.append('enabled_events[]',event);
        endpoint=await stripeForm(key,`webhook_endpoints/${encodeURIComponent(String(endpoint.id))}`,form);
      }

      if(!signingRef){
        if(!signingSecret)throw new Error('stripe_webhook_signing_secret_unavailable');
        signingRef=await storeSecret(
          admin,signingSecret,`hercules_stripe_webhook_${org}`,
          'Hercules Stripe webhook signing secret.'
        );
      }

      const keyRef=await storeSecret(
        admin,key,`hercules_stripe_secret_${org}`,'Hercules Stripe secret key.'
      );

      const connection=await upsertConnection(admin,org,'stripe',String(account.id),{
        access_secret_ref:keyRef,
        signing_secret_ref:signingRef,
        status:'active',
        connected_at:new Date().toISOString(),
        last_error:null,
        metadata:{
          receiver:STRIPE_RECEIVER,
          webhook_endpoint_id:endpoint.id,
          livemode:key.startsWith('sk_live_'),
          charges_enabled:Boolean(account.charges_enabled),
          payouts_enabled:Boolean(account.payouts_enabled),
          details_submitted:Boolean(account.details_submitted),
          catalog_ready:true,
          catalog
        }
      });

      const softwareProviderReadiness=await syncSoftwareProviderReady(admin,connection);
      const softwareCatalog=await ensureSoftwareStripeCatalog(
        admin,key,String(account.id),key.startsWith('sk_live_')
      );
      const titanCatalog=await ensureTitanStripeCatalog(
        admin,key,String(account.id),key.startsWith('sk_live_')
      );

      return j({
        ok:true,
        connection,
        webhook_endpoint_id:endpoint.id,
        catalog,
        software_catalog:softwareCatalog,
        titan_catalog:titanCatalog,
        software_provider_readiness:softwareProviderReadiness
      });
    }catch(error){
      return j({
        error:'stripe_connect_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
    }
  }

  if(action==='sync_titan_catalog'){
    if(String(identity.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      const connection=await activeStripeConnection(admin,org);
      if(!connection?.access_secret_ref)return j({error:'stripe_provider_required'},409);
      const key=await getSecret(admin,String(connection.access_secret_ref));
      const account=await stripeRequest(key,'account');
      if(!account?.id||String(account.id)!==String(connection.account_key)){
        return j({error:'stripe_account_identity_mismatch'},409);
      }
      const titanCatalog=await ensureTitanStripeCatalog(
        admin,key,String(account.id),key.startsWith('sk_live_')
      );
      return j({ok:true,titan_catalog:titanCatalog});
    }catch(error){
      return j({error:'titan_catalog_sync_failed',detail:error instanceof Error?error.message:String(error)},502);
    }
  }

  if(action==='sync_software_catalog'){
    if(String(auth.membership.role)!=='owner')return j({error:'owner_required'},403);
    try{
      const connection=await activeStripeConnection(admin,org);
      if(!connection?.access_secret_ref)return j({error:'stripe_provider_required'},409);
      const key=await getSecret(admin,String(connection.access_secret_ref));
      const account=await stripeRequest(key,'account');
      if(!account?.id||String(account.id)!==String(connection.account_key)){
        return j({error:'stripe_account_identity_mismatch'},409);
      }
      const softwareCatalog=await ensureSoftwareStripeCatalog(
        admin,key,String(account.id),key.startsWith('sk_live_')
      );
      return j({ok:true,software_catalog:softwareCatalog});
    }catch(error){
      return j({error:'software_catalog_sync_failed',detail:error instanceof Error?error.message:String(error)},502);
    }
  }

  return j({error:'unknown_action'},400);
});
