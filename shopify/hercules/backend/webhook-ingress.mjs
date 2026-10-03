import { createHash } from "node:crypto";
import { verifyShopifyWebhook, parseShopifyHeaders } from "./webhook-security.mjs";

function digest(rawBody) {
  return createHash("sha256").update(rawBody).digest("hex");
}

function response(status, code = null) {
  return { status, code };
}

export async function acceptWebhook({ rawBody, headers, secret, persist, enqueue, allowedTopics = null, findActiveInstallation = null, now = new Date() } = {}) {
  if (typeof persist !== "function" || typeof enqueue !== "function") throw new TypeError("durable_adapters_required");
  const suppliedHmac = String(headers?.get?.("x-shopify-hmac-sha256") || "");
  if (!await verifyShopifyWebhook(rawBody, suppliedHmac, secret)) return response(401, "invalid_hmac");

  let metadata;
  try {
    metadata = parseShopifyHeaders(headers);
  } catch (error) {
    return response(400, error instanceof Error ? error.message : "invalid_headers");
  }

  if (allowedTopics != null) {
    if (!(allowedTopics instanceof Set)) throw new TypeError("allowed_topics_must_be_set");
    if (!allowedTopics.has(metadata.topic)) return response(204);
  }

  let installation = null;
  if (findActiveInstallation != null) {
    if (typeof findActiveInstallation !== "function") throw new TypeError("installation_lookup_invalid");
    try {
      installation = await findActiveInstallation(metadata.shopDomain);
    } catch {
      return response(503, "installation_lookup_unavailable");
    }
    if (!installation?.id) return response(401, "inactive_installation");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  } catch {
    return response(400, "invalid_json");
  }

  const envelope = {
    ...metadata,
    ...(installation?.id ? { installationId: installation.id } : {}),
    provider: "shopify",
    receivedAt: new Date(now).toISOString(),
    payloadSha256: digest(rawBody),
    payload,
  };

  let receipt;
  try {
    receipt = await persist(envelope);
  } catch {
    return response(503, "inbox_unavailable");
  }

  if (receipt?.duplicate === true) return response(204);

  try {
    await enqueue({ receiptId: receipt?.id ?? null, webhookId: metadata.webhookId, shopDomain: metadata.shopDomain });
  } catch {
    return response(503, "queue_unavailable");
  }

  return response(204);
}
