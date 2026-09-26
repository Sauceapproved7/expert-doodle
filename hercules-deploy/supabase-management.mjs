import {SupabaseEdgeFunctionTargetAdapter} from "./supabase-edge.mjs";

const DEFAULT_API_ORIGIN = "https://api.supabase.com";
const MAX_RESPONSE_BYTES = 512 * 1024;
const PROJECT_REF = /^[a-z0-9]{20}$/;
const FUNCTION_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

function requiredToken(value) {
  const token = String(value ?? "").trim();
  if (token.length < 16) throw new TypeError("Supabase Management API access token is required");
  return token;
}

function managementOrigin(value) {
  const url = new URL(String(value ?? DEFAULT_API_ORIGIN));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new TypeError("Supabase Management API origin must be a credential-free HTTPS origin");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function targetPart(label, value, pattern) {
  const normalized = String(value ?? "").trim();
  if (!pattern.test(normalized)) throw new TypeError(label + " is invalid");
  return normalized;
}

function deploymentFiles(files) {
  if (!Array.isArray(files) || !files.length || files.length > 100) {
    throw new TypeError("Supabase deployment files are required");
  }
  return files.map((file) => {
    const name = String(file?.name ?? "").trim();
    const content = String(file?.content ?? "");
    if (!name || name.startsWith("/") || name.includes("..") || /[\\\0]/.test(name)) {
      throw new TypeError("Supabase deployment file name is invalid");
    }
    return {name, content};
  });
}

async function responseBody(response, {allowNotFound = false} = {}) {
  if (allowNotFound && response.status === 404) return null;

  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw Object.assign(new Error("Supabase Management API response too large"), {
      code: "supabase_response_too_large",
    });
  }

  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
    throw Object.assign(new Error("Supabase Management API response too large"), {
      code: "supabase_response_too_large",
    });
  }

  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw Object.assign(new Error("Supabase Management API returned invalid JSON"), {
        code: "supabase_invalid_response",
      });
    }
  }

  if (!response.ok) {
    const error = new Error("Supabase Management API request failed");
    error.statusCode = response.status;
    error.code = response.status === 401 || response.status === 403
      ? "supabase_unauthorized"
      : response.status === 429
        ? "supabase_rate_limited"
        : "supabase_api_error";
    throw error;
  }

  return parsed;
}

export class SupabaseManagementEdgeClient {
  constructor({
    accessToken,
    fetchImpl = globalThis.fetch,
    apiOrigin = DEFAULT_API_ORIGIN,
  } = {}) {
    this.accessToken = requiredToken(accessToken);
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    this.fetchImpl = fetchImpl;
    this.apiOrigin = managementOrigin(apiOrigin);
  }

  async request(path, {method = "GET", body, allowNotFound = false} = {}) {
    const response = await this.fetchImpl(this.apiOrigin + path, {
      method,
      body,
      redirect: "error",
      cache: "no-store",
      headers: {
        authorization: "Bearer " + this.accessToken,
        accept: "application/json",
      },
    });
    return responseBody(response, {allowNotFound});
  }

  async deployFunction({
    projectRef,
    slug,
    files,
    entrypointPath = "index.ts",
    verifyJwt = true,
  } = {}) {
    const ref = targetPart("projectRef", projectRef, PROJECT_REF);
    const functionSlug = targetPart("slug", slug, FUNCTION_SLUG);
    const normalizedFiles = deploymentFiles(files);
    const entrypoint = String(entrypointPath ?? "").trim();
    if (!normalizedFiles.some((file) => file.name === entrypoint)) {
      throw new TypeError("Supabase deployment entrypoint is missing");
    }

    const form = new FormData();
    form.append("metadata", JSON.stringify({
      name: functionSlug,
      entrypoint_path: entrypoint,
      verify_jwt: verifyJwt !== false,
    }));
    for (const file of normalizedFiles) {
      form.append("file", new Blob([file.content], {type: "application/typescript"}), file.name);
    }

    return this.request(
      "/v1/projects/" + encodeURIComponent(ref) +
        "/functions/deploy?slug=" + encodeURIComponent(functionSlug),
      {method: "POST", body: form},
    );
  }

  async getFunction({projectRef, slug} = {}) {
    const ref = targetPart("projectRef", projectRef, PROJECT_REF);
    const functionSlug = targetPart("slug", slug, FUNCTION_SLUG);
    return this.request(
      "/v1/projects/" + encodeURIComponent(ref) +
        "/functions/" + encodeURIComponent(functionSlug),
      {allowNotFound: true},
    );
  }

  async deleteFunction({projectRef, slug} = {}) {
    const ref = targetPart("projectRef", projectRef, PROJECT_REF);
    const functionSlug = targetPart("slug", slug, FUNCTION_SLUG);
    return this.request(
      "/v1/projects/" + encodeURIComponent(ref) +
        "/functions/" + encodeURIComponent(functionSlug),
      {method: "DELETE", allowNotFound: true},
    ) ?? {};
  }
}

export function createSupabaseManagementTargetAdapter(options = {}) {
  const client = new SupabaseManagementEdgeClient(options);
  return new SupabaseEdgeFunctionTargetAdapter({
    deployFunction: (payload) => client.deployFunction(payload),
    getFunction: (payload) => client.getFunction(payload),
    deleteFunction: (payload) => client.deleteFunction(payload),
  });
}
