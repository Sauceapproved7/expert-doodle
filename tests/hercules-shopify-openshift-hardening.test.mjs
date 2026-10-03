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
const worker=await readFile(new URL("../shopify/hercules/openshift/base/worker-deployment.yaml",import.meta.url),"utf8");
const reconciler=await readFile(new URL("../shopify/hercules/openshift/base/reconciler-cronjob.yaml",import.meta.url),"utf8");
const sql=await readFile(new URL("../supabase/migrations/20261003101500_hercules_shopify_webhook_inbox_outbox_v1.sql",import.meta.url),"utf8");

test("webhook metadata is canonical-shop and topic allowlisted",()=>{
  assert.match(security,/CANONICAL_SHOP\s*=\s*["']sauceapproved-2\.myshopify\.com["']/);
  assert.match(security,/ALLOWED_TOPICS/);
});

test("API bounds raw body and exposes only verified webhook ingress",()=>{
  assert.match(api,/MAX_BODY_BYTES/);
  assert.match(api,/\/webhooks\/shopify/);
  assert.match(api,/acceptWebhook/);
  assert.match(api,/body_too_large/);
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

test("all OpenShift workloads require digest references and API probes",()=>{
  for(const text of [deploy,worker,reconciler]){
    assert.match(text,/image:.*@sha256:[a-f0-9]{64}/);
    assert.doesNotMatch(text,/image:.*:latest/);
  }
  assert.match(deploy,/readinessProbe:/);
  assert.match(deploy,/livenessProbe:/);
});

test("public API does not receive broad privileged secrets",()=>{
  assert.doesNotMatch(deploy,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(deploy,/SHOPIFY_TOKEN_ENCRYPTION_KEY/);
  assert.match(deploy,/SHOPIFY_CLIENT_SECRET/);
  assert.match(deploy,/SHOPIFY_INGEST_TOKEN/);
});
