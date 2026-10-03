import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const serverPath=new URL("../openshift/shopify-webhook/server.mjs",import.meta.url);
const manifestPath=new URL("../openshift/shopify-webhook/manifests.yaml",import.meta.url);
const sqlPath=new URL("../supabase/migrations/20261003094500_hercules_shopify_openshift_webhook_v1.sql",import.meta.url);

test("OpenShift Shopify receiver verifies raw HMAC before JSON parsing",async()=>{
  const source=await readFile(serverPath,"utf8");
  const hmacIndex=source.indexOf("verifyShopifyHmac");
  const parseIndex=source.indexOf("JSON.parse");
  assert.ok(hmacIndex>=0,"HMAC verifier must exist");
  assert.ok(parseIndex>hmacIndex,"JSON parsing must occur only after HMAC verification path is established");
  assert.match(source,/timingSafeEqual/);
  assert.match(source,/MAX_BODY_BYTES/);
});

test("receiver requires delivery identity shop and explicit topic allowlist",async()=>{
  const source=await readFile(serverPath,"utf8");
  assert.match(source,/x-shopify-webhook-id/i);
  assert.match(source,/x-shopify-shop-domain/i);
  assert.match(source,/x-shopify-topic/i);
  assert.match(source,/ALLOWED_TOPICS/);
  assert.match(source,/sauceapproved-2\.myshopify\.com/);
});

test("receiver persists through atomic inbox outbox RPC before acknowledging",async()=>{
  const source=await readFile(serverPath,"utf8");
  assert.match(source,/hercules_shopify_webhook_ingest_v1/);
  const persistIndex=source.indexOf("hercules_shopify_webhook_ingest_v1");
  const successIndex=source.indexOf("writeHead(204)");
  assert.ok(successIndex>persistIndex,"204 must occur after durable ingest attempt");
});

test("database migration provides unique delivery dedupe and transactional outbox",async()=>{
  const sql=await readFile(sqlPath,"utf8");
  assert.match(sql,/create table if not exists public\.hercules_shopify_webhook_inbox_v1/i);
  assert.match(sql,/webhook_id uuid primary key/i);
  assert.match(sql,/create table if not exists public\.hercules_shopify_webhook_outbox_v1/i);
  assert.match(sql,/on conflict \(webhook_id\) do nothing/i);
  assert.match(sql,/hercules_shopify_webhook_ingest_v1/i);
  assert.match(sql,/digest\(p_ingest_token,'sha256'\)/i);
  assert.match(sql,/security definer/i);
});

test("OpenShift workload is restricted and does not automount Kubernetes credentials",async()=>{
  const yaml=await readFile(manifestPath,"utf8");
  assert.match(yaml,/automountServiceAccountToken:\s*false/);
  assert.match(yaml,/allowPrivilegeEscalation:\s*false/);
  assert.match(yaml,/readOnlyRootFilesystem:\s*true/);
  assert.match(yaml,/drop:\s*\["ALL"\]/);
  assert.match(yaml,/runAsNonRoot:\s*true/);
  assert.doesNotMatch(yaml,/anyuid|privileged|hostPath|hostNetwork:\s*true|hostPID:\s*true|hostIPC:\s*true/i);
});

test("OpenShift route and network policy expose only the webhook service over TLS",async()=>{
  const yaml=await readFile(manifestPath,"utf8");
  assert.match(yaml,/kind:\s*Route/);
  assert.match(yaml,/termination:\s*reencrypt/);
  assert.match(yaml,/insecureEdgeTerminationPolicy:\s*Redirect/);
  assert.match(yaml,/kind:\s*NetworkPolicy/);
  assert.match(yaml,/openshift-ingress/);
  assert.match(yaml,/policyTypes:[\s\S]*Ingress[\s\S]*Egress/);
});

test("deployment uses immutable allowed Node image and narrow secret references",async()=>{
  const yaml=await readFile(manifestPath,"utf8");
  assert.match(yaml,/node:22\.12\.0-alpine/);
  assert.match(yaml,/SHOPIFY_CLIENT_SECRET/);
  assert.match(yaml,/SHOPIFY_INGEST_TOKEN/);
  assert.match(yaml,/SUPABASE_URL/);
  assert.match(yaml,/SUPABASE_ANON_KEY/);
  assert.doesNotMatch(yaml,/SUPABASE_SERVICE_ROLE_KEY/);
});
