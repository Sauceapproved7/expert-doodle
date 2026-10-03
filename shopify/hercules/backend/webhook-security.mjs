import { createHmac, timingSafeEqual } from "node:crypto";

function rawBytes(value) {
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new TypeError("raw_body_required");
}

function validShopDomain(value) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value);
}

export async function verifyShopifyWebhook(rawBody, suppliedHmac, secret) {
  if (typeof suppliedHmac !== "string" || !suppliedHmac || typeof secret !== "string" || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBytes(rawBody)).digest();
  let supplied;
  try {
    supplied = Buffer.from(suppliedHmac, "base64");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function parseShopifyHeaders(headers) {
  const shopDomain = String(headers.get("x-shopify-shop-domain") || "").trim().toLowerCase();
  const topic = String(headers.get("x-shopify-topic") || "").trim().toLowerCase();
  const webhookId = String(headers.get("x-shopify-webhook-id") || "").trim();
  const eventId = String(headers.get("x-shopify-event-id") || "").trim();
  const apiVersion = String(headers.get("x-shopify-api-version") || "").trim();
  if (!validShopDomain(shopDomain)) throw new Error("invalid_shop_domain");
  if (!topic) throw new Error("topic_required");
  if (!webhookId) throw new Error("webhook_id_required");
  if (!/^\d{4}-\d{2}$/.test(apiVersion)) throw new Error("api_version_required");
  return { shopDomain, topic, webhookId, eventId, apiVersion };
}
