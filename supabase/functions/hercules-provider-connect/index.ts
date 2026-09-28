import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=Deno.env.get('SUPABASE_ANON_KEY')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORE='azymhc-x0.myshopify.com';
const SHOP_GID='gid://shopify/Shop/100002726208';
const RECEIVER=`${U}/functions/v1/hercules-shopify-webhook`;
const STRIPE_RECEIVER=`${U}/functions/v1/hercules-stripe-webhook`;
const STUDIO_ADS_PRODUCTS=['sauceapproved-studio','sauceapproved-ads'] as const;
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

async function activeStripeConnection(admin:any,organizationId:string){
  const {data,error}=await admin.from('hercules_provider_connections')
    .select('id,organization_id,provider,account_key,access_secret_ref,signing_secret_ref,status,connected_at,last_error,metadata,updated_at')
    .eq('organization_id',organizationId)
    .eq('provider','stripe')
    .eq('status','active')
    .not('access_secret_ref','is',null)
    .order('updated_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error)throw error;
  return data;
}

const SOFTWARE_PRODUCTS=['sauceapproved-studio','sauceapproved-ads','hercules-cleaner'] as const;

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

  const results:any[]=[];
  for(const productCode of SOFTWARE_PRODUCTS){
    const {data,error}=await admin.rpc('hercules_software_record_payment_gate',{
      p_product_code:productCode,
      p_gate:'payment_provider_ready',
      p_verified:true,
      p_evidence:evidence
    });
    if(error)throw error;
    results.push({product_code:productCode,readiness:data});
  }
  return results;
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
    || String(shop.myshopifyDomain).toLowerCase()!==STORE){
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
    || String(data.shop.myshopifyDomain).toLowerCase()!==STORE){
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
      version:'1.3.0',
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
        || String(app.shop.myshopifyDomain).toLowerCase()!==STORE){
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
          catalog_ready:true,
          catalog
        }
      });

      const softwareProviderReadiness=await syncSoftwareProviderReady(admin,connection);
      const softwareCatalog=await ensureSoftwareStripeCatalog(
        admin,key,String(account.id),key.startsWith('sk_live_')
      );

      return j({
        ok:true,
        connection,
        webhook_endpoint_id:endpoint.id,
        catalog,
        software_catalog:softwareCatalog,
        software_provider_readiness:softwareProviderReadiness
      });
    }catch(error){
      return j({
        error:'stripe_connect_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
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
