const SECRET_SHAPED = /authorization|token|secret|password|api.?key|cookie|private.?key/i;

function validateRequest(request) {
  if (!request || request.target?.kind !== "https_container") {
    throw new Error("target.kind must be https_container");
  }
  let origin;
  try {
    origin = new URL(request.publicOrigin);
  } catch {
    throw new Error("publicOrigin must be a valid HTTPS origin");
  }
  if (origin.protocol !== "https:") throw new Error("publicOrigin must use HTTPS");
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new Error("publicOrigin must be a credential-free HTTPS origin");
  }
  return origin.origin;
}

function safeEvidence(value) {
  const evidence = value && typeof value === "object" ? structuredClone(value) : {};
  for (const key of Object.keys(evidence)) {
    if (SECRET_SHAPED.test(key)) delete evidence[key];
  }
  if (SECRET_SHAPED.test(JSON.stringify(evidence))) {
    throw new Error("provider deployment evidence contains secret-shaped data");
  }
  return evidence;
}

export class HttpsContainerTargetAdapter {
  constructor({deployRelease, rollbackRelease = async () => ({rolledBack: false}), fetchImpl = globalThis.fetch} = {}) {
    if (typeof deployRelease !== "function") throw new Error("deployRelease is required");
    if (typeof rollbackRelease !== "function") throw new Error("rollbackRelease must be a function");
    if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required");
    this.deployRelease = deployRelease;
    this.rollbackRelease = rollbackRelease;
    this.fetchImpl = fetchImpl;
  }

  async deploy({deploymentId, request}) {
    const publicOrigin = validateRequest(request);
    const result = await this.deployRelease({
      deploymentId,
      serviceId: request.serviceId,
      releaseId: request.releaseId,
      sourceCommit: request.sourceCommit,
      artifactFingerprint: request.artifactFingerprint,
      publicOrigin,
      targetReference: request.target.reference,
    });
    return safeEvidence(result);
  }

  async verify({request}) {
    const publicOrigin = validateRequest(request);
    const health = await this.fetchImpl(publicOrigin + "/health", {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok) throw new Error("health verification failed");
    let body;
    try {
      body = await health.json();
    } catch {
      throw new Error("health verification failed");
    }
    if (body?.ok !== true || body?.service !== "hercules-ai" || body?.mcp !== "/mcp") {
      throw new Error("health verification failed");
    }

    const mcp = await this.fetchImpl(publicOrigin + "/mcp", {
      method: "POST",
      redirect: "error",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({jsonrpc: "2.0", id: "verify", method: "ping"}),
      signal: AbortSignal.timeout(5000),
    });
    if (![401, 403].includes(mcp.status)) {
      throw new Error("MCP endpoint is not protected");
    }
    return {
      verified: true,
      publicOrigin,
      health: true,
      mcpProtected: true,
    };
  }

  async rollback({deploymentId, request, state}) {
    validateRequest(request);
    const providerDeploymentId = state?.deployEvidence?.providerDeploymentId;
    if (typeof providerDeploymentId !== "string" || !providerDeploymentId) {
      throw new Error("provider deployment id is required for rollback");
    }
    return safeEvidence(await this.rollbackRelease({
      deploymentId,
      serviceId: request.serviceId,
      releaseId: request.releaseId,
      targetReference: request.target.reference,
      providerDeploymentId,
    }));
  }
}
