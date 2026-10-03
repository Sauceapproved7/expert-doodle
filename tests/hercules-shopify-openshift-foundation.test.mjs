import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { verifyShopifyWebhook, parseShopifyHeaders } from "../shopify/hercules/backend/webhook-security.mjs";
import { buildAdminGraphqlEndpoint } from "../shopify/hercules/backend/admin-graphql.mjs";
import { reconciliationWindow, advanceWatermark } from "../shopify/hercules/backend/reconciliation.mjs";
import { acceptWebhook } from "../shopify/hercules/backend/webhook-ingress.mjs";

test("raw Shopify webhook HMAC verifies before parsing", async () => {
  const raw = Buffer.from(JSON.stringify({ id: 123, note: "raw-bytes" }), "utf8");
  const secret = "test-secret";
  const expected = createHmac("sha256", secret).update(raw).digest("base64");
  assert.equal(await verifyShopifyWebhook(raw, expected, secret), true);
  assert.equal(await verifyShopifyWebhook(Buffer.from(raw.toString().replace("123","124")), expected, secret), false);
});

test("Shopify delivery metadata is versioned and normalized", () => {
  const headers = new Headers({
    "X-Shopify-Shop-Domain": "SauceApproved-2.myshopify.com",
    "X-Shopify-Topic": "ORDERS/PAID",
    "X-Shopify-Webhook-Id": "delivery-1",
    "X-Shopify-Event-Id": "event-1",
    "X-Shopify-Api-Version": "2026-10"
  });
  assert.deepEqual(parseShopifyHeaders(headers), {
    shopDomain: "sauceapproved-2.myshopify.com", topic: "orders/paid", webhookId: "delivery-1", eventId: "event-1", apiVersion: "2026-10"
  });
});

test("Admin GraphQL endpoint is explicit-version and myshopify-only", () => {
  assert.equal(buildAdminGraphqlEndpoint("sauceapproved-2.myshopify.com", "2026-10"), "https://sauceapproved-2.myshopify.com/admin/api/2026-10/graphql.json");
  assert.throws(() => buildAdminGraphqlEndpoint("example.com", "2026-10"), /invalid_shop_domain/);
  assert.throws(() => buildAdminGraphqlEndpoint("sauceapproved-2.myshopify.com", ""), /api_version_required/);
});

test("reconciliation overlaps safely and advances only after complete success", () => {
  const watermark = new Date("2026-10-03T00:10:00.000Z");
  const now = new Date("2026-10-03T01:00:00.000Z");
  const window = reconciliationWindow({ watermark, now, overlapMs: 5 * 60 * 1000 });
  assert.equal(window.start.toISOString(), "2026-10-03T00:05:00.000Z");
  assert.equal(window.end.toISOString(), now.toISOString());
  assert.equal(advanceWatermark({ complete: false, previous: watermark, candidate: now }).toISOString(), watermark.toISOString());
  assert.equal(advanceWatermark({ complete: true, previous: watermark, candidate: now }).toISOString(), now.toISOString());
});

test("OpenShift base separates API, worker, and reconciler and keeps secrets out of Git", async () => {
  const files = await Promise.all([
    "api-deployment.yaml","worker-deployment.yaml","reconciler-cronjob.yaml","service.yaml","route.yaml","networkpolicy.yaml","serviceaccounts.yaml"
  ].map(name => readFile(new URL(`../shopify/hercules/openshift/base/${name}`, import.meta.url), "utf8")));
  const joined = files.join("\n");
  assert.match(joined, /kind:\s*Deployment/);
  assert.match(joined, /name:\s*hercules-shopify-api/);
  assert.match(joined, /name:\s*hercules-shopify-worker/);
  assert.match(joined, /kind:\s*CronJob/);
  assert.match(joined, /name:\s*hercules-shopify-reconciler/);
  assert.match(joined, /readOnlyRootFilesystem:\s*true/);
  assert.match(joined, /runAsNonRoot:\s*true/);
  assert.match(joined, /secretKeyRef:/);
  assert.doesNotMatch(joined, /SHOPIFY_CLIENT_SECRET:\s*["\']?[^\n$]/);
  assert.doesNotMatch(joined, /COMMERCE_ENABLED\s*[:=]\s*["\']?true/i);
});

test("webhook ingress persists before enqueue and fails closed on persistence errors", async () => {
  const raw = Buffer.from(JSON.stringify({ id: 42 }), "utf8");
  const secret = "test-secret";
  const hmac = createHmac("sha256", secret).update(raw).digest("base64");
  const headers = new Headers({
    "X-Shopify-Hmac-Sha256": hmac,
    "X-Shopify-Shop-Domain": "sauceapproved-2.myshopify.com",
    "X-Shopify-Topic": "orders/paid",
    "X-Shopify-Webhook-Id": "delivery-42",
    "X-Shopify-Event-Id": "event-42",
    "X-Shopify-Api-Version": "2026-10"
  });
  const admitted = [];
  const ok = await acceptWebhook({ rawBody: raw, headers, secret, admit: async (envelope) => { admitted.push(envelope.webhookId); return { accepted: true, duplicate: false }; } });
  assert.equal(ok.status, 204);
  assert.deepEqual(admitted, ["delivery-42"]);

  const failed = await acceptWebhook({ rawBody: raw, headers, secret, admit: async () => { throw new Error("db_down"); } });
  assert.equal(failed.status, 503);
});
