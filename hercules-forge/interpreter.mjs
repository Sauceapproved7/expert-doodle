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
    fetchImpl = globalThis.fetch,
  }) {
    super();
    if (!endpoint) throw new TypeError("interpreter endpoint is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    this.endpoint = endpoint;
    this.token = token;
    this.timeoutMs = timeoutMs;
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

      const body = await response.json();
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
