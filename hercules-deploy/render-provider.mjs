const SERVICE_ID = /^srv-[a-z0-9]+$/;
const DEPLOYMENT_ID = /^dep-[a-z0-9]+$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

function requireToken(value) {
  const token = String(value ?? "").trim();
  if (token.length < 24 || /\s/.test(token)) throw new TypeError("Render API token is invalid");
  return token;
}

function normalizeAllowedServiceIds(value) {
  const ids = Array.isArray(value)
    ? value
    : String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!ids.length) throw new TypeError("at least one Render service id is required");
  const unique = [...new Set(ids)];
  for (const id of unique) {
    if (!SERVICE_ID.test(id)) throw new TypeError("Render service id is invalid");
  }
  return unique;
}

function requireCommit(value) {
  const commit = String(value ?? "").trim().toLowerCase();
  if (!COMMIT_SHA.test(commit)) throw new TypeError("Render commit SHA is invalid");
  return commit;
}

function requireDeploymentId(value) {
  const id = String(value ?? "").trim();
  if (!DEPLOYMENT_ID.test(id)) throw new TypeError("Render deployment id is invalid");
  return id;
}

async function readJson(response, label) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(label + " returned invalid JSON");
  }
}

export class RenderDeployProviderClient {
  constructor({
    apiToken,
    allowedServiceIds,
    baseUrl = "https://api.render.com",
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    const url = new URL(String(baseUrl));
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new TypeError("Render API base URL must be a credential-free HTTPS URL");
    }
    this.apiToken = requireToken(apiToken);
    this.allowedServiceIds = new Set(normalizeAllowedServiceIds(allowedServiceIds));
    this.baseUrl = url.origin;
    this.fetchImpl = fetchImpl;
  }

  assertService(serviceId) {
    const id = String(serviceId ?? "").trim();
    if (!SERVICE_ID.test(id)) throw new TypeError("Render service id is invalid");
    if (!this.allowedServiceIds.has(id)) throw new Error("Render service is not allowed");
    return id;
  }

  headers() {
    return {
      authorization: "Bearer " + this.apiToken,
      accept: "application/json",
      "content-type": "application/json",
    };
  }

  async deployRelease({serviceId, sourceCommit}) {
    const id = this.assertService(serviceId);
    const commit = requireCommit(sourceCommit);
    const response = await this.fetchImpl(
      this.baseUrl + "/v1/services/" + encodeURIComponent(id) + "/deploys",
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: this.headers(),
        body: JSON.stringify({clearCache: "do_not_clear", commitId: commit}),
      },
    );
    if (!response.ok) throw new Error("Render deploy failed with status " + response.status);
    const body = await readJson(response, "Render deploy");
    const providerDeploymentId = requireDeploymentId(body.id);
    return {provider: "render", providerDeploymentId, serviceId: id, sourceCommit: commit};
  }

  async rollbackRelease({serviceId, providerDeploymentId}) {
    const id = this.assertService(serviceId);
    const deploymentId = requireDeploymentId(providerDeploymentId);
    const response = await this.fetchImpl(
      this.baseUrl + "/v1/services/" + encodeURIComponent(id) + "/rollback",
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: this.headers(),
        body: JSON.stringify({deployId: deploymentId}),
      },
    );
    if (!response.ok) throw new Error("Render rollback failed with status " + response.status);
    const body = await readJson(response, "Render rollback");
    const returnedId = requireDeploymentId(body.id);
    return {provider: "render", providerDeploymentId: returnedId, rollbackTargetDeploymentId: deploymentId, serviceId: id, rolledBack: true};
  }
}
