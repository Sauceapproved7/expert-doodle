import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const security=await readFile(new URL("../shopify/hercules/backend/webhook-security.mjs",import.meta.url),"utf8");
const ingress=await readFile(new URL("../shopify/hercules/backend/webhook-ingress.mjs",import.meta.url),"utf8");
const api=await readFile(new URL("../shopify/hercules/backend/api.mjs",import.meta.url),"utf8");
const route=await readFile(new URL("../shopify/hercules/openshift/base/route.yaml",import.meta.url),"utf8");
const netpol=await readFile(new URL("../shopify/hercules/openshift/base/networkpolicy.yaml",import.meta.url),"utf8");
const sas=await readFile(new URL("../shopify/hercules/openshift/base/serviceaccounts.yaml",import.meta.url),"utf8");
const deploy=await readFile(new URL("../shopify/hercules/openshift/base/api-deployment.yaml",import.meta.url),"utf8");
const sql=await readFile(new URL("../supabase/migrations/20261003100000_hercules_shopify_webhook_inbox_outbox_v1.sql",import.meta.url),"utf8");

test("webhook metadata is exact-shop and topic allowlisted",()=>{
  assert.match(security,/sauceapproved-2\.myshopify\.com/);
  assert.match(security,/ALLOWED_TOPICS/);
});

test("API bounds raw body and verifies before parsing",()=>{
  assert.match(api,/MAX_BODY_BYTES/);
  assert.match(api,/acceptWebhook/);
  assert.doesNotMatch(api,/express\.json|JSON\.parse/);
});

test("ingress uses one atomic durable admission adapter",()=>{
  assert.match(ingress,/admit/);
  assert.doesNotMatch(ingress,/await persist\(/);
  assert.doesNotMatch(ingress,/await enqueue\(/);
});

test("durable inbox and outbox are inserted atomically with delivery dedupe",()=>{
  assert.match(sql,/hercules_shopify_webhook_inbox_v1/);
  assert.match(sql,/hercules_shopify_webhook_outbox_v1/);
  assert.match(sql,/webhook_id uuid primary key/i);
  assert.match(sql,/on conflict \(webhook_id\) do nothing/i);
  assert.match(sql,/hercules_shopify_webhook_ingest_v1/i);
});

test("service accounts do not automount Kubernetes API tokens",()=>{
  assert.equal((sas.match(/automountServiceAccountToken:\s*false/g)||[]).length,3);
});

test("route uses reencrypt TLS and network policy covers ingress and egress",()=>{
  assert.match(route,/termination:\s*reencrypt/);
  assert.match(route,/insecureEdgeTerminationPolicy:\s*Redirect/);
  assert.match(netpol,/policyTypes:[\s\S]*Ingress[\s\S]*Egress/);
});

test("API deployment has probes and avoids mutable latest tag",()=>{
  assert.match(deploy,/readinessProbe:/);
  assert.match(deploy,/livenessProbe:/);
  assert.doesNotMatch(deploy,/image:.*:latest/);
});
