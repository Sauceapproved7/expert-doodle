import {createHash} from "node:crypto";
import {HerculesDeployTargetAdapter} from "./adapters.mjs";

const REF = /^([a-z0-9]{20}):([a-z0-9][a-z0-9-]{0,62})$/;

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function normalizeFile(file) {
  if (!file || typeof file !== "object") throw new TypeError("edge function file is invalid");
  const name = String(file.name ?? "").trim();
  const content = String(file.content ?? "");
  if (!name || name.startsWith("/") || name.includes("..") || /[\\\0]/.test(name)) {
    throw new TypeError("edge function file name is invalid");
  }
  return {name, content};
}

export function normalizeEdgeFunctionBundle(input) {
  if (!input || typeof input !== "object") throw new TypeError("metadata.edgeFunction is required");
  const slug = String(input.slug ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) throw new TypeError("edge function slug is invalid");
  const entrypointPath = String(input.entrypointPath ?? "index.ts").trim();
  const files = Array.isArray(input.files) ? input.files.map(normalizeFile) : [];
  if (!files.length || files.length > 100) throw new TypeError("edge function files are required");
  if (!files.some((file) => file.name === entrypointPath)) throw new TypeError("edge function entrypoint is missing");
  const names = new Set();
  for (const file of files) {
    if (names.has(file.name)) throw new TypeError("edge function file names must be unique");
    names.add(file.name);
  }
  return {
    slug,
    entrypointPath,
    verifyJwt: input.verifyJwt !== false,
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function fingerprintEdgeFunctionBundle(input) {
  const bundle = normalizeEdgeFunctionBundle(input);
  return createHash("sha256").update(stable(bundle), "utf8").digest("hex");
}

function parseTarget(request) {
  if (request?.target?.kind !== "supabase_edge_function") {
    throw new TypeError("target.kind must be supabase_edge_function");
  }
  const match = REF.exec(String(request.target.reference ?? ""));
  if (!match) throw new TypeError("target.reference must be <project-ref>:<function-slug>");
  const bundle = normalizeEdgeFunctionBundle(request?.metadata?.edgeFunction);
  if (bundle.slug !== match[2]) throw new TypeError("target function slug does not match artifact slug");
  return {projectRef: match[1], slug: match[2], bundle};
}

function previousSnapshot(value) {
  if (!value) return null;
  const files = Array.isArray(value.files) ? value.files.map(normalizeFile) : [];
  return {
    slug: String(value.slug ?? value.name ?? ""),
    version: Number(value.version ?? 0) || null,
    verifyJwt: value.verify_jwt !== false,
    entrypointPath: String(value.entrypoint_path ?? "index.ts"),
    files,
  };
}

export class SupabaseEdgeFunctionTargetAdapter extends HerculesDeployTargetAdapter {
  constructor({deployFunction, getFunction, deleteFunction} = {}) {
    super();
    if (typeof deployFunction !== "function") throw new TypeError("deployFunction is required");
    if (typeof getFunction !== "function") throw new TypeError("getFunction is required");
    if (typeof deleteFunction !== "function") throw new TypeError("deleteFunction is required");
    this.deployFunction = deployFunction;
    this.getFunction = getFunction;
    this.deleteFunction = deleteFunction;
  }

  async deploy({request}) {
    const {projectRef, slug, bundle} = parseTarget(request);
    const fingerprint = fingerprintEdgeFunctionBundle(bundle);
    if (fingerprint !== request.artifactFingerprint) throw new Error("artifact fingerprint mismatch");
    const previous = previousSnapshot(await this.getFunction({projectRef, slug}));
    const deployed = await this.deployFunction({
      projectRef,
      slug,
      files: bundle.files,
      entrypointPath: bundle.entrypointPath,
      verifyJwt: bundle.verifyJwt,
    });
    return {
      provider: "supabase",
      targetKind: "supabase_edge_function",
      projectRef,
      slug,
      version: Number(deployed?.version ?? 0) || null,
      artifactFingerprint: fingerprint,
      previousVersion: previous?.version ?? null,
      previousFunction: previous,
    };
  }

  async verify({request}) {
    const {projectRef, slug, bundle} = parseTarget(request);
    const current = await this.getFunction({projectRef, slug});
    if (!current) throw Object.assign(new Error("deployed edge function not found"), {code: "supabase_function_missing"});
    if (String(current.status ?? "").toUpperCase() !== "ACTIVE") {
      throw Object.assign(new Error("deployed edge function is not active"), {code: "supabase_function_not_active"});
    }
    if (String(current.slug ?? current.name ?? "") !== slug) {
      throw Object.assign(new Error("deployed edge function slug mismatch"), {code: "supabase_function_slug_mismatch"});
    }
    if (Boolean(current.verify_jwt) !== bundle.verifyJwt) {
      throw Object.assign(new Error("deployed edge function JWT policy mismatch"), {code: "supabase_function_jwt_mismatch"});
    }
    if (Array.isArray(current.files) && current.files.length) {
      const observed = fingerprintEdgeFunctionBundle({
        slug,
        entrypointPath: String(current.entrypoint_path ?? bundle.entrypointPath),
        verifyJwt: current.verify_jwt !== false,
        files: current.files,
      });
      if (observed !== request.artifactFingerprint) {
        throw Object.assign(new Error("deployed edge function artifact mismatch"), {code: "supabase_function_artifact_mismatch"});
      }
    }
    return {
      verified: true,
      provider: "supabase",
      projectRef,
      slug,
      version: Number(current.version ?? 0) || null,
      artifactFingerprint: request.artifactFingerprint,
      verifyJwt: bundle.verifyJwt,
    };
  }

  async rollback(deployment) {
    const {projectRef, slug} = parseTarget(deployment.request);
    const previous = deployment?.state?.deployEvidence?.previousFunction ?? null;
    if (previous) {
      if (!previous.files?.length) {
        throw Object.assign(
          new Error("previous function source snapshot is unavailable"),
          {code: "supabase_rollback_snapshot_unavailable"},
        );
      }
      const restored = await this.deployFunction({
        projectRef,
        slug,
        files: previous.files,
        entrypointPath: previous.entrypointPath,
        verifyJwt: previous.verifyJwt,
      });
      return {
        rolledBack: true,
        provider: "supabase",
        projectRef,
        slug,
        mode: "restore_previous",
        version: Number(restored?.version ?? 0) || null,
      };
    }
    await this.deleteFunction({projectRef, slug});
    return {rolledBack: true, provider: "supabase", projectRef, slug, mode: "delete_new"};
  }
}
