import {SupabaseEdgeFunctionTargetAdapter} from "./supabase-edge.mjs";

const PROJECT_REF = /^[a-z0-9]{20}$/;
const FUNCTION_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

function requireToken(value) {
  const token = String(value ?? "").trim();
  if (token.length < 24 || /\s/.test(token)) {
    throw new TypeError("Supabase management access token is invalid");
  }
  return token;
}

function normalizeAllowedProjectRefs(value) {
  const refs = Array.isArray(value)
    ? value
    : String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!refs.length) throw new TypeError("at least one Supabase project ref is required");
  const unique = [...new Set(refs)];
  for (const ref of unique) {
    if (!PROJECT_REF.test(ref)) throw new TypeError("Supabase project ref is invalid");
  }
  return unique;
}

function requireSlug(value) {
  const slug = String(value ?? "").trim();
  if (!FUNCTION_SLUG.test(slug)) throw new TypeError("Supabase Edge Function slug is invalid");
  return slug;
}

function relativeFunctionPath(slug, value) {
  const normalized = String(value ?? "").replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0")) throw new TypeError("Supabase function file path is invalid");
  const markers = [
    `supabase/functions/${slug}/`,
    `functions/${slug}/`,
    `${slug}/`,
  ];
  for (const marker of markers) {
    const index = normalized.indexOf(marker);
    if (index >= 0) {
      const relative = normalized.slice(index + marker.length);
      if (relative && !relative.split("/").includes("..")) return relative;
    }
  }
  if (!normalized.includes("/") && normalized !== "..") return normalized;
  throw new TypeError("Supabase function file path is outside the function root");
}

function apiFunctionPath(slug, relativePath) {
  const clean = relativeFunctionPath(slug, relativePath);
  return `supabase/functions/${slug}/${clean}`;
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

export class SupabaseManagementEdgeFunctionClient {
  constructor({
    accessToken,
    allowedProjectRefs,
    baseUrl = "https://api.supabase.com",
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    const url = new URL(String(baseUrl));
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new TypeError("Supabase management base URL must be a credential-free HTTPS URL");
    }
    this.accessToken = requireToken(accessToken);
    this.allowedProjectRefs = new Set(normalizeAllowedProjectRefs(allowedProjectRefs));
    this.baseUrl = url.origin;
    this.fetchImpl = fetchImpl;
  }

  assertTarget(projectRef, slug) {
    const ref = String(projectRef ?? "").trim();
    if (!PROJECT_REF.test(ref)) throw new TypeError("Supabase project ref is invalid");
    if (!this.allowedProjectRefs.has(ref)) throw new Error("Supabase project ref is not allowed");
    return {projectRef: ref, slug: requireSlug(slug)};
  }

  headers(extra = {}) {
    return {
      authorization: "Bearer " + this.accessToken,
      accept: "application/json",
      ...extra,
    };
  }

  async getFunction({projectRef, slug}) {
    const target = this.assertTarget(projectRef, slug);
    const root = this.baseUrl + "/v1/projects/" + encodeURIComponent(target.projectRef) +
      "/functions/" + encodeURIComponent(target.slug);

    const metadataResponse = await this.fetchImpl(root, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: this.headers(),
    });
    if (metadataResponse.status === 404) return null;
    if (!metadataResponse.ok) {
      throw new Error("Supabase function metadata request failed with status " + metadataResponse.status);
    }
    const metadata = await readJson(metadataResponse, "Supabase function metadata");

    const bodyResponse = await this.fetchImpl(root + "/body", {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: this.headers({accept: "multipart/form-data"}),
    });
    if (!bodyResponse.ok) {
      throw new Error("Supabase function source download failed with status " + bodyResponse.status);
    }
    const form = await bodyResponse.formData();
    const rawMetadata = form.get("metadata");
    let bodyMetadata = {};
    if (typeof rawMetadata === "string" && rawMetadata.trim()) {
      try {
        bodyMetadata = JSON.parse(rawMetadata);
      } catch {
        throw new Error("Supabase function source metadata was invalid JSON");
      }
    }

    const files = [];
    for (const part of form.getAll("file")) {
      if (!part || typeof part !== "object" || typeof part.text !== "function") continue;
      const name = relativeFunctionPath(target.slug, part.name);
      files.push({name, content: await part.text()});
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    if (!files.length) throw new Error("Supabase function source download returned no files");

    const rawEntrypoint = bodyMetadata.entrypoint_path ?? metadata.entrypoint_path ?? "index.ts";
    return {
      ...metadata,
      files,
      entrypoint_path: relativeFunctionPath(target.slug, rawEntrypoint),
      verify_jwt: metadata.verify_jwt ?? bodyMetadata.verify_jwt ?? true,
    };
  }

  async deployFunction({projectRef, slug, files, entrypointPath = "index.ts", verifyJwt = true}) {
    const target = this.assertTarget(projectRef, slug);
    if (!Array.isArray(files) || !files.length) throw new TypeError("Supabase function files are required");
    const cleanEntrypoint = relativeFunctionPath(target.slug, entrypointPath);
    const form = new FormData();
    form.append("metadata", JSON.stringify({
      name: target.slug,
      verify_jwt: Boolean(verifyJwt),
      entrypoint_path: apiFunctionPath(target.slug, cleanEntrypoint),
      import_map_path: "",
      static_patterns: [],
    }));
    const seen = new Set();
    for (const file of files) {
      const name = relativeFunctionPath(target.slug, file?.name);
      if (seen.has(name)) throw new TypeError("Supabase function file names must be unique");
      seen.add(name);
      const content = String(file?.content ?? "");
      form.append(
        "file",
        new Blob([content], {type: "application/octet-stream"}),
        apiFunctionPath(target.slug, name),
      );
    }
    if (!seen.has(cleanEntrypoint)) throw new TypeError("Supabase function entrypoint is missing");

    const url = new URL(
      this.baseUrl + "/v1/projects/" + encodeURIComponent(target.projectRef) + "/functions/deploy",
    );
    url.searchParams.set("slug", target.slug);
    const response = await this.fetchImpl(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: this.headers(),
      body: form,
    });
    if (response.status !== 201) {
      throw new Error("Supabase function deploy failed with status " + response.status);
    }
    return readJson(response, "Supabase function deploy");
  }

  async deleteFunction({projectRef, slug}) {
    const target = this.assertTarget(projectRef, slug);
    const url = this.baseUrl + "/v1/projects/" + encodeURIComponent(target.projectRef) +
      "/functions/" + encodeURIComponent(target.slug);
    const response = await this.fetchImpl(url, {
      method: "DELETE",
      redirect: "error",
      cache: "no-store",
      headers: this.headers(),
    });
    if (![200, 204, 404].includes(response.status)) {
      throw new Error("Supabase function delete failed with status " + response.status);
    }
    return {deleted: response.status !== 404};
  }
}

export function createSupabaseEdgeFunctionAdapterFromEnv(
  env = process.env,
  {fetchImpl = globalThis.fetch} = {},
) {
  const accessToken = String(env.HERCULES_SUPABASE_ACCESS_TOKEN ?? "").trim();
  if (!accessToken) return null;
  const rawRefs = String(env.HERCULES_SUPABASE_PROJECT_REFS ?? "").trim();
  if (!rawRefs) throw new Error("HERCULES_SUPABASE_PROJECT_REFS is required when Supabase deployment is enabled");

  const client = new SupabaseManagementEdgeFunctionClient({
    accessToken,
    allowedProjectRefs: rawRefs.split(",").map((value) => value.trim()).filter(Boolean),
    fetchImpl,
  });
  return new SupabaseEdgeFunctionTargetAdapter({
    deployFunction: client.deployFunction.bind(client),
    getFunction: client.getFunction.bind(client),
    deleteFunction: client.deleteFunction.bind(client),
  });
}
