import {
  STUDIO_SHOPIFY_PRODUCT,
  normalizeStudioBuyerEmail,
  studioEntitlementKey,
  validateStudioShopifyPaidOrder
} from './studio-commerce.mjs';

const enc=new TextEncoder();
const MAX_BODY_BYTES=512*1024;
const TITAN_SHOPIFY_PRODUCT=Object.freeze({
  productId:'10261114782016',
  sku:'HERCULES-TITAN-FOUNDING',
  productCode:'hercules-titan-founding-access'
});

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
function exactTitanLineItem(item:any){
  const productId=String(item?.product_id??'').trim();
  const sku=String(item?.sku??'').trim();
  const quantity=Number(item?.quantity||0);
  if(productId!==TITAN_SHOPIFY_PRODUCT.productId||sku!==TITAN_SHOPIFY_PRODUCT.sku||!Number.isSafeInteger(quantity)||quantity<1){
    return null;
  }
  return {
    lineItemId:String(item?.id??'').trim()||null,
    productId,
    variantId:String(item?.variant_id??'').trim()||null,
    sku,
    quantity
  };
}

function moneyToCents(value:any){
  const amount=Number(String(value??'0'));
  return Number.isFinite(amount)&&amount>=0?Math.round(amount*100):0;
}

async function recordSoundWorldGiftEligibility(admin:any,{
  webhookId,
  order,
  productCode,
  lineItem
}:{
  webhookId:string,
  order:any,
  productCode:string,
  lineItem:any
}){
  const purchaseKey=[
    'shopify',
    String(order.shopDomain),
    String(order.orderId),
    String(productCode),
    String(lineItem?.lineItemId||lineItem?.sku||'purchase')
  ].join(':');
  const purchasedAt=String(order.processedAt||order.createdAt||new Date().toISOString());
  const buyerEmailSha256=await sha256Hex(normalizeStudioBuyerEmail(order.email));
  const {data,error}=await admin.rpc('hercules_soundworld_record_purchase_eligibility',{
    p_purchase_key:purchaseKey,
    p_provider:'shopify',
    p_provider_object_id:String(order.orderId),
    p_product_code:productCode,
    p_organization_id:null,
    p_user_id:null,
    p_buyer_email_sha256:buyerEmailSha256,
    p_purchased_at:purchasedAt,
    p_amount_cents:moneyToCents(order.totalPrice),
    p_currency:String(order.currency||'USD'),
    p_payment_settled:true,
    p_verification_purchase:false,
    p_source_event_id:webhookId,
    p_metadata:{
      source:'shopify_orders_paid',
      shop_domain:String(order.shopDomain),
      line_item_id:lineItem?.lineItemId||null,
      sku:lineItem?.sku||null,
      raw_email_stored:false
    }
  });
  if(error)throw error;
  return data;
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

  const titanGiftLines=(Array.isArray(payload.line_items)?payload.line_items:[])
    .map(exactTitanLineItem)
    .filter(Boolean);

  if(!order.match&&!titanGiftLines.length){
    await writeEvent(admin,{
      webhook_id:webhookId,event_id:eventId,topic,shop_domain:shopDomain,payload_sha256:payloadSha256,
      state:'ignored',entitlement_count:0,reason_code:'hercules_product_not_present',
      metadata:{callback_credential_verified:true,order_id:order.orderId}
    });
    return out({ok:true,ignored:true,reason:'hercules_product_not_present'});
  }

  const normalizedEmail=normalizeStudioBuyerEmail(order.email);
  const buyerEmailSha256=await sha256Hex(normalizedEmail);
  const giftEligibility=[];
  for(const line of order.lineItems){
    giftEligibility.push(await recordSoundWorldGiftEligibility(admin,{
      webhookId,
      order,
      productCode:STUDIO_SHOPIFY_PRODUCT.productCode,
      lineItem:line
    }));
  }
  for(const line of titanGiftLines){
    giftEligibility.push(await recordSoundWorldGiftEligibility(admin,{
      webhookId,
      order,
      productCode:TITAN_SHOPIFY_PRODUCT.productCode,
      lineItem:line
    }));
  }

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

  if(rows.length){
    const {error:entitlementError}=await admin.from('hercules_studio_purchase_entitlements')
      .upsert(rows,{onConflict:'entitlement_key',ignoreDuplicates:true});
    if(entitlementError)return out({error:'entitlement_persist_failed'},500);
  }

  await writeEvent(admin,{
    webhook_id:webhookId,event_id:eventId,topic,shop_domain:shopDomain,payload_sha256:payloadSha256,
    state:'entitled',entitlement_count:rows.length,reason_code:null,
    metadata:{
      order_id:order.orderId,
      entitlement_version:STUDIO_SHOPIFY_PRODUCT.entitlementVersion,
      callback_credential_verified:true,
      soundworld_gift_eligibility:giftEligibility,
      titan_gift_line_count:titanGiftLines.length,
      raw_email_stored:false
    }
  });
  return out({
    ok:true,
    entitled:rows.length>0,
    entitlementCount:rows.length,
    soundworldGiftEligibility:giftEligibility
  });
}
