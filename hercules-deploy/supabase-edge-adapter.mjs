import {HerculesDeployTargetAdapter} from "./adapters.mjs";

const TARGET_REFERENCE = /^([a-z0-9][a-z0-9-]{3,63})\/([a-z0-9][a-z0-9_-]{0,127})$/;
const DEFAULT_API_ORIGIN = "https://api.supabase.com";
const MAX_RESPONSE_BYTES = 512 * 1024;

function parseTarget(reference) {
  const match = TARGET_REFERENCE.exec(String(reference ?? ""));
  if (!match) {
    throw new TypeError("Supabase target.reference must be project-ref/function-slug");
  }
  return {projectRef: match[1], functionSlug: match[2]};
}

function requireToken(value) {
  const token = String(value ?? "").trim();
  if (!token) throw new TypeError("Supabase Management API access token is required");
  return token;
}

function normalizeOrigin(value) {
  const url = new URL(String(value ?? DEFAULT_API_ORIGIN));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new TypeError("Supabase Management API origin must be a credential-free HTTPS origin");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function normalizeArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") throw new TypeError("Supabase deployment artifact is required");
  const entrypointPath = String(artifact.entrypointPath ?? "").trim();
  if (!entrypointPath) throw new TypeError("Supabase artifact entrypointPath is required");
  if (!Array.isArray(artifact.files) || artifact.files.length === 0) {
    throw new TypeError("Supabase artifact files are required");
  }
  const files = artifact.files.map((file) => {
    const name = String(file?.name ?? "").trim();
    const content = String(file?.content ?? "");
    if (!name || name.startsWith("/") || name.includes("..")) {
      throw new TypeError("Supabase artifact file name is invalid");
    }
    return {name, content};
  });
  if (!files.some((file) => file.name === entrypointPath)) {
    throw new TypeError("Supabase artifact entrypointPath must exist in files");
  }
  return {
    entrypointPath,
    verifyJwt: artifact.verifyJwt !== false,
    importMapPath: artifact.importMapPath ? String(artifact.importMapPath) : null,
    files,
  };
}

async function readJsonResponse(response) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw Object.assign(new Error("Supabase Management API response too large"), {
      code: "supabase_response_too_large",
    });
  }
  const body = await response.text();
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
    throw Object.assign(new Error("Supabase Management API response too large"), {
      code: "supabase_response_too_large",
    });
  }
  let parsed = {};
  if (body) {
    try {
      parsed = JSON.parse(body);
    } catch {
      throw Object.assign(new Error("Supabase Management API returned invalid JSON"), {
        code: "supabase_invalid_response",
      });
    }
  }
  if (!response.ok) {
    const error = new Error("Supabase Management API request failed");
    error.code = response.status === 401 || response.status === 403
      ? "supabase_unauthorized"
      : response.status === 429
        ? "supabase_rate_limited"
        : "supabase_api_error";
    error.statusCode = response.status;
    throw error;
  }
  return parsed;
}

function safeEvidence({projectRef, functionSlug, result}) {
  return {
    targetKind: "supabase_edge_function",
    projectRef,
    functionSlug,
    status: String(result?.status ?? "UNKNOWN"),
    version: Number.isSafeInteger(result?.version) ? result.version : null,
    verifyJwt: result?.verify_jwt !== false,
    entrypointPath: result?.entrypoint_path ? String(result.entrypoint_path) : null,
    bundleSha256: result?.ezbr_sha256 ? String(result.ezbr_sha256) : null,
  };
}

export class SupabaseEdgeFunctionAdapter extends HerculesDeployTargetAdapter {
  constructor({
    accessToken,
    artifactLoader,
    fetchImpl = globalThis.fetch,
    apiOrigin = DEFAULT_API_ORIGIN,
  } = {}) {
    super();
    this.accessToken = requireToken(accessToken);
    if (typeof artifactLoader !== "function") throw new TypeError("artifactLoader is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    this.artifactLoader = artifactLoader;
    this.fetchImpl = fetchImpl;
    this.apiOrigin = normalizeOrigin(apiOrigin);
  }

  async request(path, options = {}) {
    const response = await this.fetchImpl(this.apiOrigin + path, {
      ...options,
      redirect: "error",
      cache: "no-store",
      headers: {
        authorization: "Bearer " + this.accessToken,
        accept: "application/json",
        ...(options.headers ?? {}),
      },
    });
    return readJsonResponse(response);
  }

  async deployArtifact(deployment, purpose) {
    const {projectRef, functionSlug} = parseTarget(deployment?.request?.target?.reference);
    const artifact = normalizeArtifact(await this.artifactLoader(deployment, purpose));
    const form = new FormData();
    form.append("metadata", JSON.stringify({
      entrypoint_path: artifact.entrypointPath,
      verify_jwt: artifact.verifyJwt,
      ...(artifact.importMapPath ? {import_map_path: artifact.importMapPath} : {}),
    }));
    for (const file of artifact.files) {
      form.append("file", new Blob([file.content], {type: "application/typescript"}), file.name);
    }

    const result = await this.request(
      "/v1/projects/" + encodeURIComponent(projectRef) +
        "/functions/deploy?slug=" + encodeURIComponent(functionSlug),
      {method: "POST", body: form},
    );
    return safeEvidence({projectRef, functionSlug, result});
  }

  async deploy(deployment) {
    return this.deployArtifact(deployment, "deploy");
  }

  async verify(deployment) {
    const {projectRef, functionSlug} = parseTarget(deployment?.request?.target?.reference);
    const result = await this.request(
      "/v1/projects/" + encodeURIComponent(projectRef) +
        "/functions/" + encodeURIComponent(functionSlug),
      {method: "GET"},
    );
    const evidence = safeEvidence({projectRef, functionSlug, result});
    if (evidence.status !== "ACTIVE") {
      throw Object.assign(new Error("Supabase Edge Function is not ACTIVE"), {
        code: "supabase_function_not_active",
      });
    }
    return {...evidence, verified: true};
  }

  async rollback(deployment) {
    const evidence = await this.deployArtifact(deployment, "rollback");
    if (evidence.status !== "ACTIVE") {
      throw Object.assign(new Error("Supabase rollback did not become ACTIVE"), {
        code: "supabase_rollback_not_active",
      });
    }
    return {...evidence, rolledBack: true};
  }
}

export {parseTarget as parseSupabaseEdgeTarget};
