import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../../supabase/functions/hercules-gatehouse-order-readback/index.ts",import.meta.url),"utf8");

test("dedicated edge route requires authenticated owner before accessing stored Shopify connection",()=>{
 assert.match(source,/req\.method\s*!==\s*['"]GET['"]/);
 assert.match(source,/auth\.getUser\(/);
 assert.match(source,/hercules_memberships/);
 assert.match(source,/status.*active/);
 assert.match(source,/role.*owner/);
 assert.match(source,/hercules_provider_connections/);
 assert.match(source,/hercules_get_secret/);
});
test("readback route uses scoped fixed Shopify host and owned read-only operation",()=>{
 assert.match(source,/CANONICAL_SHOP/);
 assert.match(source,/SHOPIFY_ORDER_QUERY/);
 assert.match(source,/first:\s*10/);
 assert.match(source,/graphql\.json/);
 assert.doesNotMatch(source,/webhookSubscriptionCreate|bulkOperationRunQuery|fulfillmentCreate|refundCreate|draftOrderCreate/);
});
test("no unsafe browser CORS, no captured raw buyers, no commerce unlock",()=>{
 assert.doesNotMatch(source,/access-control-allow-origin/i);
 assert.doesNotMatch(source,/\.select\([^\n]*(customer_email|billing_address)/);
 assert.doesNotMatch(source,/deliveryAuthorized:\s*true|productionAuthorized:\s*true|purchaseEnabled:\s*true/);
});
