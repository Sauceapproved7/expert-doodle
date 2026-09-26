function normalizeEndpoint(value) {
  let url;
  try {
    url = new URL(String(value ?? ""));
  } catch {
    throw new TypeError("deploy endpoint must be a valid URL");
  }
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new TypeError("deploy endpoint must use https unless it is loopback");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("deploy endpoint must not include credentials, query, or fragment");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export class HttpHerculesDeployClient {
  constructor({
    endpoint,
    token,
    timeoutMs = 15_000,
    maxResponseBytes = 512 * 1024,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof token !== "string" || token.length < 16) {
      throw new TypeError("deploy control token must be at least 16 characters");
    }
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
      throw new TypeError("timeoutMs must be between 1 and 120000");
    }
    if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1024) {
      throw new TypeError("maxResponseBytes must be at least 1024");
    }
    this.endpoint = normalizeEndpoint(endpoint);
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
  }

  async request(path, {method = "GET", body} = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint + path, {
        method,
        redirect: "error",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          authorization: "Bearer " + this.token,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const declared = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(declared) && declared > this.maxResponseBytes) {
        throw new Error("deploy response too large");
      }
      const text = await response.text();
      if (Buffer.byteLength(text) > this.maxResponseBytes) {
        throw new Error("deploy response too large");
      }
      let parsed = {};
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("deploy response was not valid JSON");
        }
      }
      if (!response.ok) {
        const error = new Error(parsed.error ?? ("deploy request failed with status " + response.status));
        error.statusCode = response.status;
        throw error;
      }
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  async enqueue(request, {deploymentId} = {}) {
    return this.request("/v1/deployments", {
      method: "POST",
      body: deploymentId ? {deploymentId, request} : {request},
    });
  }

  async get(deploymentId) {
    return this.request("/v1/deployments/" + encodeURIComponent(deploymentId));
  }

  async retry(deploymentId) {
    return this.request("/v1/deployments/" + encodeURIComponent(deploymentId) + "/retry", {
      method: "POST",
    });
  }

  async rollback(deploymentId) {
    return this.request("/v1/deployments/" + encodeURIComponent(deploymentId) + "/rollback", {
      method: "POST",
    });
  }
}

export {normalizeEndpoint};
