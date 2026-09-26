import {readFile} from "node:fs/promises";
import {resolve, sep} from "node:path";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function safeId(label, value) {
  const id = String(value ?? "");
  if (!ID.test(id)) throw new TypeError(label + " must be a path-safe identifier");
  return id;
}

function within(root, ...parts) {
  const base = resolve(root);
  const candidate = resolve(base, ...parts);
  if (candidate !== base && !candidate.startsWith(base + sep)) {
    throw new TypeError("artifact path escapes configured root");
  }
  return candidate;
}

async function readManifest(directory) {
  const raw = await readFile(within(directory, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw);
  if (!manifest || typeof manifest !== "object") throw new TypeError("artifact manifest is invalid");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new TypeError("artifact manifest files are required");
  }
  return manifest;
}

export function createFileSystemSupabaseArtifactLoader({root} = {}) {
  if (!root) throw new TypeError("Supabase artifact root is required");
  const artifactRoot = resolve(root);

  return async function loadSupabaseArtifact(deployment, purpose = "deploy") {
    const serviceId = safeId("serviceId", deployment?.request?.serviceId);
    let releaseId = safeId("releaseId", deployment?.request?.releaseId);
    let directory = within(artifactRoot, serviceId, releaseId);
    let manifest = await readManifest(directory);

    if (purpose === "rollback") {
      releaseId = safeId("rollbackReleaseId", manifest.rollbackReleaseId);
      directory = within(artifactRoot, serviceId, releaseId);
      manifest = await readManifest(directory);
    } else if (purpose !== "deploy") {
      throw new TypeError("unsupported artifact purpose");
    }

    const files = [];
    for (const item of manifest.files) {
      const name = String(item ?? "");
      if (!name || name.startsWith("/") || name.includes("..") || name.includes("\\")) {
        throw new TypeError("artifact file path is invalid");
      }
      files.push({
        name,
        content: await readFile(within(directory, name), "utf8"),
      });
    }

    return {
      releaseId,
      entrypointPath: String(manifest.entrypointPath ?? ""),
      verifyJwt: manifest.verifyJwt !== false,
      importMapPath: manifest.importMapPath ? String(manifest.importMapPath) : null,
      files,
    };
  };
}
