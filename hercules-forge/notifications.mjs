export class ForgeNotificationAdapter {
  async send() {
    throw new Error("ForgeNotificationAdapter.send must be implemented by a replaceable adapter");
  }
}

function assertNotification(notification) {
  if (!notification || typeof notification !== "object") {
    throw new TypeError("notification is required");
  }
  if (!["invite", "recovery"].includes(notification.kind)) {
    throw new TypeError("notification kind is invalid");
  }
  const to = String(notification.to ?? "").trim().toLowerCase();
  if (!to || to.length > 254 || !to.includes("@")) {
    throw new TypeError("notification recipient is invalid");
  }
  const link = new URL(String(notification.link ?? ""));
  if (link.protocol !== "https:" && link.hostname !== "127.0.0.1" && link.hostname !== "localhost") {
    throw new TypeError("notification link must use https unless loopback");
  }
  if (link.username || link.password) {
    throw new TypeError("notification link must not embed credentials");
  }
  const expiresAt = String(notification.expiresAt ?? "");
  if (!Number.isFinite(Date.parse(expiresAt))) {
    throw new TypeError("notification expiresAt is invalid");
  }
  return {kind: notification.kind, to, link: link.toString(), expiresAt};
}

export class HttpForgeNotificationAdapter extends ForgeNotificationAdapter {
  constructor({
    endpoint,
    token = null,
    timeoutMs = 15000,
    maxResponseBytes = 64 * 1024,
    fetchImpl = globalThis.fetch,
  }) {
    super();
    if (!endpoint) throw new TypeError("notification endpoint is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) {
      throw new TypeError("timeoutMs must be between 1 and 120000");
    }
    if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0) {
      throw new TypeError("maxResponseBytes must be a positive integer");
    }

    const parsed = new URL(endpoint);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new TypeError("notification endpoint must use http or https");
    }
    if (parsed.username || parsed.password) {
      throw new TypeError("notification endpoint must not embed credentials");
    }

    this.endpoint = parsed.toString();
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
  }

  async send(notification) {
    const payload = assertNotification(notification);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = {"content-type": "application/json"};
      if (this.token) headers.authorization = "Bearer " + this.token;
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        body: JSON.stringify({
          protocol: "hercules-forge-notification/0.1",
          notification: payload,
        }),
      });
      if (!response.ok) {
        throw new Error("notification request failed with status " + response.status);
      }
      const declaredLength = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
        throw new Error("notification response too large");
      }
      const text = await response.text();
      if (Buffer.byteLength(text) > this.maxResponseBytes) {
        throw new Error("notification response too large");
      }
      return {delivered: true};
    } finally {
      clearTimeout(timer);
    }
  }
}

export class MemoryForgeNotificationAdapter extends ForgeNotificationAdapter {
  constructor() {
    super();
    this.notifications = [];
  }

  async send(notification) {
    const payload = assertNotification(notification);
    this.notifications.push(structuredClone(payload));
    return {delivered: true};
  }
}

export {assertNotification};
