export class HerculesTrainingRunner {
  async run() {
    throw new Error("run() must be implemented by a training runner");
  }
}

export class HttpTrainingRunner extends HerculesTrainingRunner {
  constructor({
    endpoint,
    token = null,
    timeoutMs = 24 * 60 * 60 * 1000,
    maxResponseBytes = 1024 * 1024,
    fetchImpl = globalThis.fetch,
  }) {
    super();
    if (!endpoint) throw new TypeError("training runner endpoint is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 24 * 60 * 60 * 1000) {
      throw new TypeError("timeoutMs must be between 1 and 86400000");
    }
    if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0) {
      throw new TypeError("maxResponseBytes must be a positive integer");
    }

    const url = new URL(endpoint);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new TypeError("training runner endpoint must use http or https");
    }
    if (url.username || url.password) {
      throw new TypeError("training runner endpoint must not embed credentials");
    }

    this.endpoint = url.toString();
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
  }

  async run({job, datasets}) {
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
          protocol: "hercules-training-worker/0.1",
          job,
          datasets,
        }),
      });

      if (!response.ok) {
        throw new Error("training runner failed with status " + response.status);
      }

      const declared = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(declared) && declared > this.maxResponseBytes) {
        throw new Error("training runner response too large");
      }

      const text = await response.text();
      if (Buffer.byteLength(text) > this.maxResponseBytes) {
        throw new Error("training runner response too large");
      }

      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error("training runner returned invalid JSON");
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new Error("training runner returned invalid result");
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
}
