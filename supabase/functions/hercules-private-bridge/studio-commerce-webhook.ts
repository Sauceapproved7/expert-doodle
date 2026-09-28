import {
  STUDIO_SHOPIFY_PRODUCT,
  normalizeStudioBuyerEmail,
  studioEntitlementKey,
  validateStudioShopifyPaidOrder
} from './studio-commerce.mjs';

const enc=new TextEncoder();
const MAX_BODY_BYTES=512*1024;

function out(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer'
    }
  });
}
async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function callbackAuthorized(admin:any,supplied:string){
  if(supplied.length<48)return false;
  const digest=await sha256Hex(supplied);
  const {data,error}=await admin.from('hercules_internal_service_keys')
    .select('key_sha256,enabled')
    .eq('purpose','studio-shopify-orders-paid')
    .eq('enabled',true)
    .limit(1)
    .maybeSingle();
  return !error&&Boolean(data?.enabled&&data?.key_sha256)&&safeEqual(String(data.key_sha256),digest);
}
async function eventRecord(admin:any,webhookId:string){
  const {data}=await admin.from('hercules_studio_shopify_webhook_events')
    .select('webhook_id,payload_sha256,state,entitlement_count')
    .eq('webhook_id',webhookId)
    .maybeSingle();
  return data||null;
}
async function writeEvent(admin:any,row:any){
  await admin.from('hercules_studio_shopify_webhook_events').upsert(row,{onConflict:'webhook_id'});
}

export function isStudioShopifyPaidWebhook(url:URL){
  return url.searchParams.has('studio_shopify_order_paid');
}

export async function handleStudioShopifyPaidWebhook(req:Request,url:URL,admin:any){
  if(req.method!=='POST')return out({error:'method_not_allowed'},405);
  const credential=String(url.searchParams.get('studio_shopify_order_paid')||'');
  if(!await callbackAuthorized(admin,credential)){
    return out({error:'shopify_webhook_unauthorized'},401);
  }

  const shopDomain=String(req.headers.get('x-shopify-shop-domain')||'').trim().toLowerCase();
  const topic=String(req.headers.get('x-shopify-topic')||'').trim().toLowerCase();
  const webhookId=String(req.headers.get('x-shopify-webhook-id')||'').trim();
  const eventId=String(req.headers.get('x-shopify-event-id')||'').trim()||null;
  if(!webhookId||webhookId.length>160)return out({error:'shopify_webhook_id_required'},400);
  if(shopDomain!==STUDIO_SHOPIFY_PRODUCT.shopDomain)return out({error:'shop_domain_mismatch'},403);
  if(topic!=='orders/paid')return out({error:'webhook_topic_mismatch'},400);

  const len=Number(req.headers.get('content-length')||'0');
  if(Number.isFinite(len)&&len>MAX_BODY_BYTES)return out({error:'payload_too_large'},413);
  const raw=await req.text();
  if(raw.length>MAX_BODY_BYTES)return out({error:'payload_too_large'},413);
  const payloadSha256=await sha256Hex(raw);

  const existing=await eventRecord(admin,webhookId);
  if(existing){
    if(existing.payload_sha256!==payloadSha256)return out({error:'webhook_id_payload_conflict'},409);
    return out({ok:true,replayed:true,state:existing.state,entitlementCount:existing.entitlement_count||0});
  }

  let payload:any;
  try{payload=JSON.parse(raw)}catch{
    await writeEvent(admin,{
      webhook_id:webhookId,event_id:eventId,topic,shop_domain:shopDomain,payload_sha256:payloadSha256,
      state:'rejected',entitlement_count:0,reason_code:'invalid_json',metadata:{callback_credential_verified:true}
    });
    return out({ok:true,rejected:true,reason:'invalid_json'});
  }

  let order:any;
  try{
    order=validateStudioShopifyPaidOrder(payload,{shopDomain,topic});
  }catch(error){
    const reason=error instanceof Error?error.message:'order_validation_failed';
    await writeEvent(admin,{
      webhook_id:webhookId,event_id:eventId,topic,shop_domain:shopDomain,payload_sha256:payloadSha256,
      state:'rejected',entitlement_count:0,reason_code:reason,
      metadata:{callback_credential_verified:true,shop_header_verified:true,topic_header_verified:true}
    });
    return out({ok:true,rejected:true,reason});
  }

  if(!order.match){
    await writeEvent(admin,{
      webhook_id:webhookId,event_id:eventId,topic,shop_domain:shopDomain,payload_sha256:payloadSha256,
      state:'ignored',entitlement_count:0,reason_code:'studio_product_not_present',
      metadata:{callback_credential_verified:true,order_id:order.orderId}
    });
    return out({ok:true,ignored:true,reason:'studio_product_not_present'});
  }

  const normalizedEmail=normalizeStudioBuyerEmail(order.email);
  const buyerEmailSha256=await sha256Hex(normalizedEmail);
  const rows=[];
  for(const line of order.lineItems){
    rows.push({
      entitlement_key:await studioEntitlementKey(order,line),
      provider:'shopify',
      shop_domain:order.shopDomain,
      provider_order_id:order.orderId,
      provider_line_item_id:line.lineItemId,
      product_code:STUDIO_SHOPIFY_PRODUCT.productCode,
      product_id:line.productId,
      variant_id:line.variantId,
      sku:line.sku,
      quantity:line.quantity,
      buyer_email_sha256:buyerEmailSha256,
      status:'paid_pending_claim',
      source_webhook_id:webhookId,
      currency:order.currency,
      paid_total:order.totalPrice,
      metadata:{
        entitlement_version:STUDIO_SHOPIFY_PRODUCT.entitlementVersion,
        plan_code:STUDIO_SHOPIFY_PRODUCT.planCode,
        source:'shopify_orders_paid',
        callback_credential_verified:true,
        shop_header_verified:true,
        topic_header_verified:true,
        shopify_hmac_verified:false,
        raw_email_stored:false
      }
    });
  }

  const {error:entitlementError}=await admin.from('hercules_studio_purchase_entitlements')
    .upsert(rows,{onConflict:'entitlement_key',ignoreDuplicates:true});
  if(entitlementError)return out({error:'entitlement_persist_failed'},500);

  await writeEvent(admin,{
    webhook_id:webhookId,event_id:eventId,topic,shop_domain:shopDomain,payload_sha256:payloadSha256,
    state:'entitled',entitlement_count:rows.length,reason_code:null,
    metadata:{
      order_id:order.orderId,
      entitlement_version:STUDIO_SHOPIFY_PRODUCT.entitlementVersion,
      callback_credential_verified:true,
      raw_email_stored:false
    }
  });
  return out({ok:true,entitled:true,entitlementCount:rows.length});
}
