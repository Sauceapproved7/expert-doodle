export class ForgeInterpreter {
  async interpret() {
    throw new Error("ForgeInterpreter.interpret must be implemented by a replaceable adapter");
  }
}

export class StaticForgeInterpreter extends ForgeInterpreter {
  constructor(spec) {
    super();
    this.spec = spec;
  }

  async interpret() {
    return structuredClone(this.spec);
  }
}

export class HttpForgeInterpreter extends ForgeInterpreter {
  constructor({
    endpoint,
    token = null,
    timeoutMs = 30000,
    maxResponseBytes = 1024 * 1024,
    fetchImpl = globalThis.fetch,
  }) {
    super();
    if (!endpoint) throw new TypeError("interpreter endpoint is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) {
      throw new TypeError("timeoutMs must be between 1 and 300000");
    }
    if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0) {
      throw new TypeError("maxResponseBytes must be a positive integer");
    }

    const parsed = new URL(endpoint);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new TypeError("interpreter endpoint must use http or https");
    }
    if (parsed.username || parsed.password) {
      throw new TypeError("interpreter endpoint must not embed credentials");
    }

    this.endpoint = parsed.toString();
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
  }

  async interpret(prompt) {
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new TypeError("prompt must be a non-empty string");
    }

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
          protocol: "hercules-forge-interpreter/0.1",
          prompt: prompt.trim(),
          output: "forge-spec",
          specVersion: "0.1",
        }),
      });

      if (!response.ok) {
        throw new Error("interpreter request failed with status " + response.status);
      }

      const declaredLength = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
        throw new Error("interpreter response too large");
      }

      const text = await response.text();
      if (Buffer.byteLength(text) > this.maxResponseBytes) {
        throw new Error("interpreter response too large");
      }

      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error("interpreter returned invalid JSON");
      }

      const spec = body?.spec ?? body;
      if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        throw new Error("interpreter did not return a Forge spec object");
      }
      return spec;
    } finally {
      clearTimeout(timer);
    }
  }
}
