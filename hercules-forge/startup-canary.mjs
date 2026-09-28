const PROJECT_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const CANARY_MARKER = "forge-startup-prompt-v1";
const CANARY_PURPOSE = "synthetic-production-certification";
const CANARY_PROMPT = "Build a minimal internal canary app for verifying Hercules Forge AI ingress. Include a Check entity with one required label string field, a list page for Check, and a create action for Check. Keep the application minimal and do not add integrations.";

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("canary origin must be a valid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("canary origin must use http or https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("canary origin must not embed credentials, query, or fragment");
  }
  return url.origin;
}

function validateInputs({controlToken, projectId, timeoutMs}) {
  if (typeof controlToken !== "string" || controlToken.length < 32) {
    throw new TypeError("controlToken must be at least 32 characters");
  }
  if (!PROJECT_ID.test(String(projectId ?? ""))) {
    throw new TypeError("projectId must be a safe Forge identifier");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) {
    throw new TypeError("timeoutMs must be between 1000 and 300000");
  }
}

async function readBoundedJson(response) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("startup canary response too large");
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
    throw new Error("startup canary response too large");
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("startup canary received invalid JSON");
  }
}

async function requestJson(fetchImpl, url, {controlToken = null, method = "GET", body = null, timeoutMs}) {
  const headers = {accept:"application/json"};
  if (controlToken) headers.authorization = "Bearer " + controlToken;
  if (body !== null) headers["content-type"] = "application/json";

  const response = await fetchImpl(url, {
    method,
    headers,
    body:body === null ? undefined : JSON.stringify(body),
    redirect:"error",
    cache:"no-store",
    signal:AbortSignal.timeout(timeoutMs),
  });
  return {response, payload:await readBoundedJson(response)};
}

function assertCertifiedProject(project, projectId) {
  if (
    project?.projectId !== projectId ||
    project?.metadata?.source !== "prompt" ||
    project?.metadata?.canary !== CANARY_MARKER ||
    project?.metadata?.purpose !== CANARY_PURPOSE ||
    !/^[a-f0-9]{64}$/.test(String(project?.metadata?.promptSha256 ?? ""))
  ) {
    throw new Error("startup canary project collides with non-canary project");
  }
}

function assertDurableReady(payload) {
  if (
    payload?.ready !== true ||
    payload?.durableState?.ok !== true ||
    payload?.durableState?.schema !== "sauceapproved.hercules.forge.durable-state.v1" ||
    payload?.durableState?.carriesCredentials !== false
  ) {
    throw new Error("startup canary durable readiness verification failed");
  }
  const count = Number(payload.durableState.objectCount);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("startup canary durable state object count is invalid");
  }
  return count;
}

export async function runForgeStartupPromptCanary({
  origin,
  controlToken,
  projectId,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  validateInputs({controlToken, projectId, timeoutMs});
  const base = normalizeOrigin(origin);
  const projectUrl = base + "/v1/projects/" + encodeURIComponent(projectId);

  const existing = await requestJson(fetchImpl, projectUrl, {
    controlToken,
    timeoutMs,
  });

  if (existing.response.status === 200) {
    assertCertifiedProject(existing.payload?.project, projectId);
    const ready = await requestJson(fetchImpl, base + "/ready", {timeoutMs});
    if (!ready.response.ok) throw new Error("startup canary readiness request failed");
    return {
      ok:true,
      status:"already_verified",
      projectId,
      durableObjectCount:assertDurableReady(ready.payload),
    };
  }
  if (existing.response.status !== 404) {
    throw new Error("startup canary project lookup failed with status " + existing.response.status);
  }

  const created = await requestJson(fetchImpl, base + "/v1/projects/from-prompt", {
    method:"POST",
    controlToken,
    timeoutMs,
    body:{
      prompt:CANARY_PROMPT,
      metadata:{
        projectId,
        canary:CANARY_MARKER,
        purpose:CANARY_PURPOSE,
      },
    },
  });
  if (created.response.status !== 201) {
    const safeCode = typeof created.payload?.code === "string" &&
      /^forge_[a-z0-9_]{1,80}$/.test(created.payload.code)
      ? created.payload.code
      : null;
    throw new Error(
      "startup canary project creation failed with status " +
      created.response.status +
      (created.payload?.error ? ": " + created.payload.error : "") +
      (safeCode ? " [" + safeCode + "]" : ""),
    );
  }

  assertCertifiedProject(created.payload?.project, projectId);
  const revisionId = String(created.payload?.revision?.revisionId ?? "");
  if (!revisionId) throw new Error("startup canary did not return an immutable revision");

  const reread = await requestJson(fetchImpl, projectUrl, {
    controlToken,
    timeoutMs,
  });
  if (!reread.response.ok) throw new Error("startup canary project reread failed");
  assertCertifiedProject(reread.payload?.project, projectId);

  const ready = await requestJson(fetchImpl, base + "/ready", {timeoutMs});
  if (!ready.response.ok) throw new Error("startup canary readiness request failed");

  return {
    ok:true,
    status:"created_and_verified",
    projectId,
    revisionId,
    durableObjectCount:assertDurableReady(ready.payload),
  };
}

export const FORGE_STARTUP_CANARY_MARKER = CANARY_MARKER;
export const FORGE_STARTUP_CANARY_PURPOSE = CANARY_PURPOSE;
