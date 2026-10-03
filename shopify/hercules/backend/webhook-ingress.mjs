import { createHash } from "node:crypto";
import { verifyShopifyWebhook, parseShopifyHeaders } from "./webhook-security.mjs";

function digest(rawBody) {
  return createHash("sha256").update(rawBody).digest("hex");
}

function response(status, code = null) {
  return { status, code };
}

export async function acceptWebhook({ rawBody, headers, secret, admit, now = new Date() } = {}) {
  if (typeof admit !== "function") throw new TypeError("durable_admission_required");
  const suppliedHmac = String(headers?.get?.("x-shopify-hmac-sha256") || "");
  if (!await verifyShopifyWebhook(rawBody, suppliedHmac, secret)) return response(401, "invalid_hmac");

  let metadata;
  try {
    metadata = parseShopifyHeaders(headers);
  } catch (error) {
    return response(400, error instanceof Error ? error.message : "invalid_headers");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  } catch {
    return response(400, "invalid_json");
  }

  const envelope = {
    ...metadata,
    provider: "shopify",
    receivedAt: new Date(now).toISOString(),
    payloadSha256: digest(rawBody),
    payload,
  };

  try {
    const receipt = await admit(envelope);
    if (receipt?.accepted !== true && receipt?.duplicate !== true) return response(503, "durable_admission_rejected");
  } catch {
    return response(503, "durable_admission_unavailable");
  }

  return response(204);
}
