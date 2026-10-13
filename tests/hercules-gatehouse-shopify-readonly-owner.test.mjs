import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");
const ddl=readFileSync(new URL("../supabase/gatehouse_shopify_readonly_connections.sql",import.meta.url),"utf8");
const configure=source.slice(source.indexOf("if(action==='configure_gatehouse_shopify_readonly')"),
 source.indexOf("if(action==='gatehouse_shopify_readonly_status')"));
const status=source.slice(source.indexOf("if(action==='gatehouse_shopify_readonly_status')"),
 source.indexOf("if(action==='gatehouse_shopify_readonly_observe')"));
const observe=source.slice(source.indexOf("if(action==='gatehouse_shopify_readonly_observe')"),
 source.indexOf("if(action==='configure_shopify')"));
test("Gatehouse Shopify has distinct owner-only read_order connection, no mutation-capable webhook setup",()=>{
 assert.ok(configure.startsWith("if(action==='configure_gatehouse_shopify_readonly')"));
 assert.match(configure,/identity\.membership\.role.*owner/);
 assert.match(configure,/clientId!==GATEHOUSE_SHOPIFY_CLIENT_ID/);
 assert.match(configure,/exchangeGatehouseShopifyGrant/);
 assert.match(configure,/verifyGatehouseShopifyOrderPermission/);
 assert.match(configure,/\.from\('gatehouse_shopify_readonly_connections'\)/);
 assert.doesNotMatch(configure,/upsertConnection\(|webhookSubscriptionCreate|observeShopifyDomains|observeShopifyLaunch|stripeRequest|mutation /);
 assert.doesNotMatch(configure,/\.from\('hercules_provider_connections'\)/);
});
test("Shopify token response must include read_orders and bounded expiry; cannot use app ID as token",()=>{
 assert.match(source,/const GATEHOUSE_SHOPIFY_CLIENT_ID='1ed12710f0b797a7a3328c1cf4e8b1f9'/);
 assert.match(source,/response\.status!==200/);
 assert.match(source,/\.split\(','\).*\.includes\('read_orders'\)/);
 assert.match(source,/expires_in/);
 assert.match(source,/redirect:'error'/);
 assert.match(source,/const SHOPIFY_API_HOST='azymhc-x0\.myshopify\.com'/);
});
test("Initial grant uses only read_orders and shop identity, no rich product fields",()=>{
 const precheck=source.slice(source.indexOf("async function verifyGatehouseShopifyOrderPermission"),
  source.indexOf("async function checkGatehouseShopifyOrderReadback"));
 assert.match(precheck,/orders\(first:1\)/);
 assert.match(precheck,/shop\{id myshopifyDomain\}/);
 assert.doesNotMatch(precheck,/lineItems|product\s*\{|variant\s*\{|mutation/);
});
test("Live order verification attests fixed shop and checks exact product, price, refund before only aggregate counts",()=>{
 assert.match(source,/const GATEHOUSE_SHOPIFY_ORDER_QUERY=/);
 assert.match(source,/orders\(first:\s*\$first/);
 assert.match(source,/GATEHOUSE_SHOPIFY_PRODUCT_ID/);
 assert.match(source,/GATEHOUSE_SHOPIFY_VARIANT_ID/);
 assert.match(source,/HG-DIAGNOSTIC-49/);
 assert.match(source,/displayFinancialStatus/);
 assert.match(source,/totalRefundedSet/);
 assert.match(source,/return.*candidateCount/);
 assert.doesNotMatch(observe,/shopifyGraphql\([^\n]+\bmutation\b/i);
 assert.doesNotMatch(observe,/webhookSubscriptionCreate|refundCreate|fulfillmentCreate/);
});
test("Owner status and observation leak no tokens, customer information, or report delivery authority",()=>{
 assert.ok(status.startsWith("if(action==='gatehouse_shopify_readonly_status')"));
 assert.match(status,/identity\.membership\.role.*owner/);
 assert.ok(observe.startsWith("if(action==='gatehouse_shopify_readonly_observe')"));
 assert.match(observe,/identity\.membership\.role.*owner/);
 assert.doesNotMatch(observe,/customer\.email|order\.email|order\.id\s*[:,]/);
 assert.match(observe,/deliveryAuthorized:false/);
 assert.match(observe,/purchaseEnabled:false/);
 assert.match(status,/readOnly:true/);
});
test("Read-only credential table is strictly separate from commerce provider and default private",()=>{
 assert.match(ddl,/create table public\.gatehouse_shopify_readonly_connections/i);
 assert.match(ddl,/primary key references public\.hercules_organizations/i);
 assert.match(ddl,/check \(status = 'readback-only'\)/i);
 assert.match(ddl,/check \(shop_domain = 'azymhc-x0\.myshopify\.com'\)/i);
 assert.match(ddl,/enable row level security/i);
 assert.match(ddl,/revoke all on public\.gatehouse_shopify_readonly_connections from anon, authenticated/i);
 assert.doesNotMatch(ddl,/grant\s+(select|all|insert|update)/i);
 assert.doesNotMatch(ddl,/alter table public\.hercules_provider_connections/i);
});
test("Owner UI offers consented Shopify order-read with no monitor auto-enable and clears secret fields",()=>{
 assert.match(ui,/id="shopreadonly"/);
 assert.match(ui,/Connect Shopify orders — read only/);
 const handler=ui.slice(ui.indexOf("$('shopreadonly').onclick"),ui.indexOf("$('shopsave').onclick"));
 assert.match(handler,/configure_gatehouse_shopify_readonly/);
 assert.match(handler,/\$\('shopsecret'\)\.value=''/);
 assert.doesNotMatch(handler,/configure_shopify'|reconcileDomain|shopify_domain_reconcile|launchReadinessStatus/);
});
