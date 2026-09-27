import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const A=Deno.env.get('SUPABASE_ANON_KEY')!;
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORE='azymhc-x0.myshopify.com';
const SHOP_GID='gid://shopify/Shop/100002726208';
const RECEIVER=`${U}/functions/v1/hercules-shopify-webhook`;
const STRIPE_RECEIVER=`${U}/functions/v1/hercules-stripe-webhook`;

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

async function internalAuthorized(req:Request,admin:any){
  const supplied=req.headers.get('x-hercules-internal-key')||'';
  if(!supplied)return false;

  const {data}=await admin.from('hercules_internal_service_keys')
    .select('key_sha256,enabled')
    .eq('purpose','shopify-domain-monitor')
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

Deno.serve(async req=>{
  if(req.method==='GET'){
    return j({
      ok:true,
      service:'hercules-provider-connect',
      version:'1.1.0',
      providers:['shopify','stripe'],
      store:STORE,
      shopGid:SHOP_GID,
      domainMonitor:true
    });
  }

  if(req.method!=='POST')return j({error:'method_not_allowed'},405);

  const admin=createClient(U,S,{auth:{persistSession:false}});

  if(req.headers.get('x-hercules-internal-key')){
    if(!await internalAuthorized(req,admin))return j({error:'unauthorized'},401);

    const body=await req.json().catch(()=>({}));
    if(String(body.action||'')!=='monitor_shopify_domain'){
      return j({error:'internal_action_not_allowed'},400);
    }

    try{
      return j(await observeShopifyDomains(admin));
    }catch(error){
      return j({
        error:'shopify_domain_monitor_failed',
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
      return j({ok:true,connection,created_topics:created,domain});
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

      const accountResponse=await fetch('https://api.stripe.com/v1/account',{
        headers:{Authorization:`Bearer ${key}`},
        signal:AbortSignal.timeout(30000)
      });
      const account=await accountResponse.json();
      if(!accountResponse.ok||!account.id){
        throw new Error(account?.error?.message||`stripe_account_${accountResponse.status}`);
      }

      const listResponse=await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100',{
        headers:{Authorization:`Bearer ${key}`},
        signal:AbortSignal.timeout(30000)
      });
      const list=await listResponse.json();
      if(!listResponse.ok)throw new Error(list?.error?.message||'stripe_list_failed');

      let endpoint=(list.data||[]).find((item:any)=>item.url===STRIPE_RECEIVER);
      let signingSecret='';

      if(!endpoint){
        const form=new URLSearchParams();
        form.set('url',STRIPE_RECEIVER);
        for(const event of [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.payment_succeeded',
          'invoice.payment_failed'
        ])form.append('enabled_events[]',event);

        const createResponse=await fetch('https://api.stripe.com/v1/webhook_endpoints',{
          method:'POST',
          headers:{
            Authorization:`Bearer ${key}`,
            'content-type':'application/x-www-form-urlencoded'
          },
          body:form,
          signal:AbortSignal.timeout(30000)
        });
        const created=await createResponse.json();
        if(!createResponse.ok){
          throw new Error(created?.error?.message||'stripe_webhook_create_failed');
        }
        endpoint=created;
        signingSecret=String(created.secret||'');
      }

      const keyRef=await storeSecret(
        admin,key,`hercules_stripe_secret_${org}`,'Hercules Stripe secret key.'
      );
      let signingRef=null;
      if(signingSecret){
        signingRef=await storeSecret(
          admin,signingSecret,`hercules_stripe_webhook_${org}`,
          'Hercules Stripe webhook signing secret.'
        );
      }

      const connection=await upsertConnection(admin,org,'stripe',String(account.id),{
        access_secret_ref:keyRef,
        signing_secret_ref:signingRef,
        status:'active',
        connected_at:new Date().toISOString(),
        last_error:null,
        metadata:{
          receiver:STRIPE_RECEIVER,
          webhook_endpoint_id:endpoint.id,
          livemode:Boolean(account.livemode)
        }
      });

      return j({ok:true,connection,webhook_endpoint_id:endpoint.id});
    }catch(error){
      return j({
        error:'stripe_connect_failed',
        detail:error instanceof Error?error.message:String(error)
      },502);
    }
  }

  return j({error:'unknown_action'},400);
});
