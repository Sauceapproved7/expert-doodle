import {createHash} from "node:crypto";
import policy from "./shopify-paid-order-runner-policy.json" with {type:"json"};

export const RUNNER_POLICY=Object.freeze({
  lookbackHours:policy.lookbackHours,
  maxOrdersPerRun:policy.maxOrdersPerRun,
  allowedProducts:policy.allowedProducts
});

export function normalizeBuyerEmail(value){return String(value??"").trim().toLowerCase();}
export function sha256(value){return createHash("sha256").update(value,"utf8").digest("hex");}

function exactAllowedProduct(line){
  return policy.allowedProducts.find((allowed)=>
    String(line?.productId??"")===allowed.productId &&
    String(line?.variantId??"")===allowed.variantId &&
    String(line?.sku??"").trim()===allowed.sku
  )??null;
}

export function buildReconciliationCalls(order,{now=new Date()}={}){
  if(!order||String(order.shopDomain??"").toLowerCase()!==policy.canonicalShopDomain)return [];
  const financialStatus=String(order.financialStatus??"").toLowerCase();
  const paymentSettled=order.paymentSettled===true;
  const test=order.test===true;
  const cancelled=order.cancelled===true||Boolean(order.cancelledAt);
  if(financialStatus!=="paid"||!paymentSettled||test||cancelled)return [];
  const processedAt=new Date(order.processedAt);
  if(Number.isNaN(processedAt.getTime()))return [];
  const cutoff=new Date(now.getTime()-policy.lookbackHours*60*60*1000);
  if(processedAt<cutoff||processedAt>now)return [];
  const normalizedEmail=normalizeBuyerEmail(order.email);
  if(!normalizedEmail)return [];
  const buyer_email_sha256=sha256(normalizedEmail);
  return (Array.isArray(order.lineItems)?order.lineItems:[]).flatMap((line)=>{
    const allowed=exactAllowedProduct(line); if(!allowed)return [];
    const quantity=Number(line.quantity),amount_cents=Number(line.amountCents);
    if(!Number.isInteger(quantity)||quantity<1||quantity>100)return [];
    if(!Number.isSafeInteger(amount_cents)||amount_cents<0)return [];
    const currency=String(line.currency??order.currency??"").trim().toUpperCase();
    if(!/^[A-Z]{3}$/.test(currency))return [];
    return [{rpc:"hercules_reconcile_verified_shopify_paid_order_v1",args:{
      p_shop_domain:policy.canonicalShopDomain,p_order_id:String(order.id??"").trim(),
      p_line_item_id:String(line.id??"").trim(),p_product_id:allowed.productId,p_variant_id:allowed.variantId,
      p_sku:allowed.sku,p_quantity:quantity,p_buyer_email_sha256:buyer_email_sha256,
      p_processed_at:processedAt.toISOString(),p_amount_cents:amount_cents,p_currency:currency,
      p_payment_settled:true,p_test:false,p_cancelled:false,p_source:"connected_shopify_admin_api"
    }}];
  });
}

export async function reconcilePaidOrders({orders,invokeRpc,now=new Date()}){
  if(typeof invokeRpc!=="function")throw new TypeError("invokeRpc_required");
  const bounded=(Array.isArray(orders)?orders:[]).slice(0,policy.maxOrdersPerRun),results=[];
  for(const order of bounded)for(const call of buildReconciliationCalls(order,{now}))results.push(await invokeRpc(call.rpc,call.args));
  return {checked:bounded.length,reconciled:results.length,results};
}
