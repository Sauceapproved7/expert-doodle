import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const provider=await readFile(
  new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),
  "utf8"
);
const webhook=await readFile(
  new URL("../supabase/functions/hercules-shopify-webhook/index.ts",import.meta.url),
  "utf8"
);

test("provider subscribes to Shopify domain lifecycle topics",()=>{
  for(const topic of ["DOMAINS_CREATE","DOMAINS_UPDATE","DOMAINS_DESTROY"]){
    assert.match(provider,new RegExp(topic));
  }
});

test("webhook recognizes only Shopify domain lifecycle topics for fast-path monitoring",()=>{
  assert.match(webhook,/new Set\(\['domains\/create','domains\/update','domains\/destroy'\]\)/);
  assert.match(webhook,/if\(!DOMAIN_TOPICS\.has\(topic\)\)return null/);
});

test("native domain event nudge occurs only after HMAC, store and webhook-id checks",()=>{
  const hmac=webhook.indexOf("invalid_hmac");
  const shop=webhook.indexOf("shop_not_allowed",hmac);
  const delivery=webhook.indexOf("missing_webhook_id",shop);
  const persist=webhook.indexOf("persist('shopify'",delivery);
  const nudge=webhook.indexOf("nudgeDomainMonitor(topic)",persist);
  assert.ok(hmac>=0 && shop>hmac && delivery>shop && persist>delivery && nudge>persist);
});

test("domain monitor nudge is non-fatal to accepted webhook persistence",()=>{
  assert.match(webhook,/catch\{\s*return \{queued:false,error:'monitor_submit_failed'\}/);
  assert.match(webhook,/domainMonitor=await nudgeDomainMonitor\(topic\);return json\(\{received:true,mode:'native_hmac'/);
});

test("webhook keeps existing replay and signature protections",()=>{
  assert.match(webhook,/hercules_bridge_token_valid/);
  assert.match(webhook,/hercules_bridge_nonces/);
  assert.match(webhook,/x-shopify-hmac-sha256/);
  assert.match(webhook,/safe\(supplied,expected\)/);
  assert.match(webhook,/unique_receipt_first/);
});

test("Shopify control plane and webhook receiver use the live SauceApproved store domain",()=>{
  assert.match(provider,/const STORE='sauceapproved-2\.myshopify\.com'/);
  assert.match(webhook,/const STORE='sauceapproved-2\.myshopify\.com'/);
  assert.doesNotMatch(provider,/azymhc-x0\.myshopify\.com/);
  assert.doesNotMatch(webhook,/azymhc-x0\.myshopify\.com/);
});
