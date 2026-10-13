import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),"utf8");
const observe=source.slice(source.indexOf("if(action==='gatehouse_shopify_readonly_observe')"),
 source.indexOf("if(action==='configure_shopify')"));
test("owner-only order reader renews an expired Shopify credential and verifies new grant",()=>{
 assert.match(observe,/identity\.membership\.role.*owner/);
 assert.match(observe,/const renew=async\(\)=>/);
 assert.match(observe,/exchangeGatehouseShopifyGrant\(data\.client_id,secret\)/);
 assert.match(observe,/verifyGatehouseShopifyOrderPermission\(grant\.token\)/);
 assert.match(observe,/\.from\('gatehouse_shopify_readonly_connections'\)/);
 assert.match(observe,/access_secret_ref:newRef/);
});
test("premature 401 triggers at most one credential re-exchange, not unconditional repeats",()=>{
 assert.match(observe,/const initiallyExpired=Date\.parse\(data\.access_expires_at\)<=Date\.now\(\)\+60000/);
 assert.match(observe,/if\(!initiallyExpired&&Number\(\(error as any\)\?\.status\)===401\)/);
 assert.match(observe,/evidence=await checkGatehouseShopifyOrderReadback\(await renew\(\),10\)/);
 assert.doesNotMatch(observe,/while\s*\(|setInterval\(|setTimeout\(/);
});
test("unsupported permissions and other upstream failures never trigger renew or widen scope",()=>{
 assert.match(observe,/evidence=await checkGatehouseShopifyOrderReadback\(token,10\)/);
 assert.doesNotMatch(observe,/webhookSubscriptionCreate|configure_shopify|write_orders|read_products|fulfillmentCreate|refundCreate|mutation /);
 assert.match(observe,/purchaseEnabled:false,deliveryAuthorized:false,customerEntitlementGranted:false/);
 assert.match(observe,/gatehouse_shopify_order_readback_failed/);
 assert.doesNotMatch(observe,/token:|secret:|customerEmail|orderId|rawOrder/);
});
