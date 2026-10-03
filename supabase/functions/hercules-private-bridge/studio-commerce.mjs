export const STUDIO_SHOPIFY_PRODUCT=Object.freeze({
  shopDomain:"sauceapproved-2.myshopify.com",
  shopDomains:Object.freeze([
    "sauceapproved-2.myshopify.com",
    "azymhc-x0.myshopify.com",
    "sauceapproved-3.myshopify.com"
  ]),
  shopGid:"gid://shopify/Shop/100002726208",
  productId:"15397259477312",
  variantId:"67601341153600",
  sku:"SA-STUDIO-PILOT-001",
  productCode:"sauceapproved-studio",
  planCode:"founding-pilot",
  entitlementVersion:"studio-shopify-founding-pilot-v1"
});

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeStudioBuyerEmail(value){
  const email=String(value??"").trim().toLowerCase();
  if(!email||email.length>254||!EMAIL.test(email))throw new Error("invalid_buyer_email");
  return email;
}

function idString(value){
  if(value===null||value===undefined)return "";
  return String(value).trim();
}

function exactStudioLineItem(item){
  if(!item||typeof item!=="object")return null;
  const productId=idString(item.product_id);
  const variantId=idString(item.variant_id);
  const sku=String(item.sku??"").trim();
  const quantity=Number(item.quantity);
  if(
    productId!==STUDIO_SHOPIFY_PRODUCT.productId||
    variantId!==STUDIO_SHOPIFY_PRODUCT.variantId||
    sku!==STUDIO_SHOPIFY_PRODUCT.sku||
    !Number.isSafeInteger(quantity)||
    quantity<1
  )return null;
  return Object.freeze({
    lineItemId:idString(item.id)||null,
    productId,
    variantId,
    sku,
    quantity
  });
}

export function isStudioShopDomainAllowed(value){
  const domain=String(value??"").trim().toLowerCase();
  return STUDIO_SHOPIFY_PRODUCT.shopDomains.includes(domain);
}

export function validateStudioShopifyPaidOrder(payload={},context={}){
  const sourceShopDomain=String(context.shopDomain??"").trim().toLowerCase();
  const topic=String(context.topic??"").trim().toLowerCase();
  if(!isStudioShopDomainAllowed(sourceShopDomain))throw new Error("shop_domain_mismatch");
  const shopDomain=STUDIO_SHOPIFY_PRODUCT.shopDomain;
  if(topic!=="orders/paid")throw new Error("webhook_topic_mismatch");
  if(String(payload.financial_status??"").trim().toLowerCase()!=="paid")throw new Error("order_not_paid");
  if(payload.test===true)throw new Error("test_order_not_eligible");
  if(payload.cancelled_at)throw new Error("cancelled_order_not_eligible");

  const orderId=idString(payload.id);
  if(!orderId)throw new Error("order_id_required");
  const email=normalizeStudioBuyerEmail(payload.email);
  const rawItems=Array.isArray(payload.line_items)?payload.line_items:[];
  const lineItems=Object.freeze(rawItems.map(exactStudioLineItem).filter(Boolean));
  return Object.freeze({
    schema:"sauceapproved.hercules.studio-shopify-paid-order.v1",
    match:lineItems.length>0,
    shopDomain,
    sourceShopDomain,
    topic,
    orderId,
    email,
    createdAt:String(payload.created_at??"").trim()||null,
    processedAt:String(payload.processed_at??"").trim()||String(payload.created_at??"").trim()||null,
    currency:String(payload.currency??"").trim().toUpperCase()||null,
    totalPrice:String(payload.total_price??"").trim()||null,
    lineItems
  });
}

function stable(value){
  if(value===null||typeof value!=="object")return value;
  if(Array.isArray(value))return value.map(stable);
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
}

function hex(bytes){
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

export async function studioEntitlementKey(order,lineItem){
  if(!order?.shopDomain||!order?.orderId||!lineItem?.variantId||!lineItem?.sku){
    throw new Error("entitlement_identity_incomplete");
  }
  const identity=stable({
    version:STUDIO_SHOPIFY_PRODUCT.entitlementVersion,
    provider:"shopify",
    shopDomain:String(order.shopDomain),
    orderId:String(order.orderId),
    productId:String(lineItem.productId),
    variantId:String(lineItem.variantId),
    sku:String(lineItem.sku)
  });
  return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(identity))));
}
