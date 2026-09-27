function normalizeEndpoint(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("bank endpoint is required");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("bank endpoint must be an absolute URL");
  }
  if (url.username || url.password) throw new TypeError("bank endpoint must not contain credentials");
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback.has(url.hostname))) {
    throw new TypeError("bank endpoint must use HTTPS unless it is loopback");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(label + " must be a non-empty string");
  }
  return value.trim();
}

export class HerculesBankClient {
  #endpoint;
  #tokenProvider;
  #fetch;
  #timeoutMs;

  constructor({
    endpoint,
    tokenProvider,
    fetchImpl = fetch,
    timeoutMs = 5000,
  } = {}) {
    this.#endpoint = normalizeEndpoint(endpoint);
    if (typeof tokenProvider !== "function") throw new TypeError("tokenProvider is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) {
      throw new TypeError("timeoutMs is invalid");
    }
    this.#tokenProvider = tokenProvider;
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
  }

  async listAccounts() {
    const body = await this.#request("/v1/accounts");
    return body.accounts;
  }

  async openAccount() {
    const body = await this.#request("/v1/accounts", {method:"POST", body:{}});
    return body.account;
  }

  async getAccount(accountId) {
    const body = await this.#request("/v1/accounts/" + encodeURIComponent(nonEmpty(accountId, "accountId")));
    return body.account;
  }

  async statement(accountId) {
    const body = await this.#request(
      "/v1/accounts/" + encodeURIComponent(nonEmpty(accountId, "accountId")) + "/statement",
    );
    return body.statement;
  }

  async transfer(input) {
    const body = await this.#request("/v1/transfers", {method:"POST", body:input});
    return body;
  }

  async fundSandbox(input) {
    const body = await this.#request("/v1/admin/fund-sandbox", {method:"POST", body:input});
    return body.account;
  }

  async #request(path, {method = "GET", body} = {}) {
    const token = await this.#tokenProvider();
    if (typeof token !== "string" || token.length === 0) {
      throw new Error("Hercules Bank access token is required");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const headers = {
        authorization:"Bearer " + token,
        accept:"application/json",
      };
      if (body !== undefined) headers["content-type"] = "application/json";

      const response = await this.#fetch(this.#endpoint + path, {
        method,
        headers,
        body:body === undefined ? undefined : JSON.stringify(body),
        cache:"no-store",
        redirect:"error",
        signal:controller.signal,
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw Object.assign(new Error("invalid Hercules Bank response"), {
          statusCode:response.status,
        });
      }

      if (!response.ok) {
        const message = typeof payload?.error === "string"
          ? payload.error
          : "Hercules Bank request failed";
        throw Object.assign(new Error(message), {
          statusCode:response.status,
          code:payload?.error,
        });
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }
}
