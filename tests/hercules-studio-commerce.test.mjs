import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStudioBuyerEmail,
  validateStudioShopifyPaidOrder,
  studioEntitlementKey,
  STUDIO_SHOPIFY_PRODUCT
} from "../supabase/functions/hercules-private-bridge/studio-commerce.mjs";

function paidOrder(overrides={}){
  return {
    id: 900000001,
    email: " Buyer@Example.COM ",
    financial_status: "paid",
    currency: "USD",
    total_price: "99.00",
    test: false,
    line_items: [{
      id: 1,
      product_id: 15397259477312,
      variant_id: 67601341153600,
      sku: "SA-STUDIO-PILOT-001",
      quantity: 1,
      title: "SauceApproved Studio — Founding Pilot Access"
    }],
    ...overrides
  };
}

test("normalizes buyer email deterministically",()=>{
  assert.equal(normalizeStudioBuyerEmail(" Buyer@Example.COM "), "buyer@example.com");
  assert.throws(()=>normalizeStudioBuyerEmail("not-an-email"),/invalid_buyer_email/);
});

test("accepts only the exact paid Studio founding-pilot line item",()=>{
  const result=validateStudioShopifyPaidOrder(paidOrder(),{
    shopDomain:"sauceapproved-2.myshopify.com",
    topic:"orders/paid"
  });
  assert.equal(result.match,true);
  assert.equal(result.email,"buyer@example.com");
  assert.equal(result.orderId,"900000001");
  assert.equal(result.lineItems.length,1);
  assert.equal(result.lineItems[0].sku,STUDIO_SHOPIFY_PRODUCT.sku);
  assert.equal(result.lineItems[0].quantity,1);
});

test("accepts Shopify native myshopify alias and normalizes it to the canonical store identity",()=>{
  const result=validateStudioShopifyPaidOrder(paidOrder(),{
    shopDomain:"azymhc-x0.myshopify.com",
    topic:"orders/paid"
  });
  assert.equal(result.match,true);
  assert.equal(result.shopDomain,"sauceapproved-2.myshopify.com");
  assert.ok(STUDIO_SHOPIFY_PRODUCT.shopDomains.includes("azymhc-x0.myshopify.com"));
  assert.ok(STUDIO_SHOPIFY_PRODUCT.shopDomains.includes("sauceapproved-2.myshopify.com"));
});

test("rejects non-paid payloads fail closed",()=>{
  assert.throws(()=>validateStudioShopifyPaidOrder(
    paidOrder({financial_status:"pending"}),
    {shopDomain:"sauceapproved-2.myshopify.com",topic:"orders/paid"}
  ),/order_not_paid/);
});

test("rejects unexpected Shopify shop or topic",()=>{
  assert.throws(()=>validateStudioShopifyPaidOrder(
    paidOrder(),
    {shopDomain:"other-shop.myshopify.com",topic:"orders/paid"}
  ),/shop_domain_mismatch/);
  assert.throws(()=>validateStudioShopifyPaidOrder(
    paidOrder(),
    {shopDomain:"sauceapproved-2.myshopify.com",topic:"orders/create"}
  ),/webhook_topic_mismatch/);
});

test("ignores paid orders that do not contain the Studio product",()=>{
  const result=validateStudioShopifyPaidOrder(
    paidOrder({line_items:[{product_id:1,variant_id:2,sku:"OTHER",quantity:1}]}),
    {shopDomain:"sauceapproved-2.myshopify.com",topic:"orders/paid"}
  );
  assert.equal(result.match,false);
  assert.deepEqual(result.lineItems,[]);
});

test("requires product id, variant id, and sku to all match",()=>{
  for(const patch of [
    {product_id:1},
    {variant_id:2},
    {sku:"SA-STUDIO-PILOT-FAKE"}
  ]){
    const li={...paidOrder().line_items[0],...patch};
    const result=validateStudioShopifyPaidOrder(
      paidOrder({line_items:[li]}),
      {shopDomain:"sauceapproved-2.myshopify.com",topic:"orders/paid"}
    );
    assert.equal(result.match,false);
  }
});

test("derives an idempotent entitlement key without buyer PII",async()=>{
  const order=validateStudioShopifyPaidOrder(paidOrder(),{
    shopDomain:"sauceapproved-2.myshopify.com",
    topic:"orders/paid"
  });
  const a=await studioEntitlementKey(order,order.lineItems[0]);
  const b=await studioEntitlementKey(order,order.lineItems[0]);
  assert.equal(a,b);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.equal(a.includes("buyer@example.com"),false);
});

test("rejects Shopify test orders and cancelled orders",()=>{
  assert.throws(()=>validateStudioShopifyPaidOrder(
    paidOrder({test:true}),
    {shopDomain:"sauceapproved-2.myshopify.com",topic:"orders/paid"}
  ),/test_order_not_eligible/);
  assert.throws(()=>validateStudioShopifyPaidOrder(
    paidOrder({cancelled_at:"2026-09-28T12:00:00Z"}),
    {shopDomain:"sauceapproved-2.myshopify.com",topic:"orders/paid"}
  ),/cancelled_order_not_eligible/);
});
