import {createHash, randomUUID} from "node:crypto";
import {mkdir, readFile, readdir, rename, rm, stat, writeFile} from "node:fs/promises";
import {dirname, join, relative, resolve, sep} from "node:path";

const MANAGED_ROOTS = Object.freeze([
  "projects",
  "identity",
  "audit",
  "runtime-data",
  "runtime-snapshots",
  "releases",
]);
const SHA256 = /^[a-f0-9]{64}$/;
const DEFAULT_CHUNK_BYTES = 192 * 1024;
const DEFAULT_MAX_OBJECT_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function validateEndpoint(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TypeError("durable state endpoint must be a valid URL");
  }
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new TypeError("durable state endpoint must use https unless it is loopback");
  }
  if (url.username || url.password || url.hash) {
    throw new TypeError("durable state endpoint must not embed credentials or fragments");
  }
  return url.toString();
}

function normalizeRemotePath(value) {
  const path = String(value ?? "");
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("invalid durable state path");
  }
  if (!MANAGED_ROOTS.some((root) => path === root || path.startsWith(root + "/"))) {
    throw new Error("unmanaged durable state path");
  }
  return path;
}

function assertInside(root, target) {
  const base = resolve(root);
  const resolved = resolve(target);
  const rel = relative(base, resolved);
  if (rel === "" || (!rel.startsWith(".." + sep) && rel !== "..")) return resolved;
  throw new Error("durable state path escapes root");
}

function normalizeManifestObject(value) {
  if (!value || typeof value !== "object") throw new Error("invalid durable state manifest object");
  const path = normalizeRemotePath(value.path);
  const bytes = Number(value.bytes);
  const chunks = Number(value.chunks);
  const digest = String(value.sha256 ?? "");
  if (!SHA256.test(digest)) throw new Error("invalid durable state object sha256");
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > DEFAULT_MAX_OBJECT_BYTES) {
    throw new Error("invalid durable state object size");
  }
  if (!Number.isSafeInteger(chunks) || chunks < 1 || chunks > 4096) {
    throw new Error("invalid durable state object chunk count");
  }
  return {path, bytes, chunks, sha256:digest};
}

async function walkFiles(base, current = base, output = []) {
  let entries;
  try {
    entries = await readdir(current, {withFileTypes:true});
  } catch (error) {
    if (error?.code === "ENOENT") return output;
    throw error;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const target = join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error("durable state does not follow symbolic links");
    if (entry.isDirectory()) {
      await walkFiles(base, target, output);
      continue;
    }
    if (!entry.isFile()) throw new Error("unexpected durable state filesystem entry");
    output.push(target);
  }
  return output;
}

export class ForgeDurableStateMirror {
  constructor({
    root,
    endpoint,
    token,
    fetchImpl = globalThis.fetch,
    chunkBytes = DEFAULT_CHUNK_BYTES,
    maxObjectBytes = DEFAULT_MAX_OBJECT_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }) {
    if (typeof root !== "string" || !root) throw new TypeError("durable state root is required");
    if (typeof token !== "string" || token.length < 32) {
      throw new TypeError("durable state token must be at least 32 characters");
    }
    if (typeof fetchImpl !== "function") throw new TypeError("durable state fetch implementation is required");
    if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 8 || chunkBytes > 1024 * 1024) {
      throw new TypeError("durable state chunkBytes must be between 8 and 1048576");
    }
    if (!Number.isSafeInteger(maxObjectBytes) || maxObjectBytes < chunkBytes) {
      throw new TypeError("durable state maxObjectBytes must be an integer >= chunkBytes");
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
      throw new TypeError("durable state timeoutMs must be between 1000 and 120000");
    }
    this.root = resolve(root);
    this.endpoint = validateEndpoint(endpoint);
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.chunkBytes = chunkBytes;
    this.maxObjectBytes = maxObjectBytes;
    this.timeoutMs = timeoutMs;
    this.queue = Promise.resolve();
  }

  async request(body) {
    const response = await this.fetchImpl(this.endpoint, {
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-hercules-forge-state-key":this.token,
      },
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(this.timeoutMs),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error || ("durable state HTTP " + response.status));
      error.statusCode = response.status;
      throw error;
    }
    return payload;
  }

  async remoteManifest() {
    const body = await this.request({action:"forge_state_manifest"});
    const objects = Array.isArray(body?.objects) ? body.objects.map(normalizeManifestObject) : [];
    const seen = new Set();
    for (const object of objects) {
      if (seen.has(object.path)) throw new Error("duplicate durable state manifest path");
      seen.add(object.path);
    }
    return objects.sort((a, b) => a.path.localeCompare(b.path));
  }

  async scanLocal() {
    const objects = [];
    for (const managedRoot of MANAGED_ROOTS) {
      const base = join(this.root, managedRoot);
      for (const path of await walkFiles(base)) {
        const info = await stat(path);
        if (info.size > this.maxObjectBytes) {
          throw Object.assign(new Error("durable state object exceeds maximum size"), {statusCode:413});
        }
        const rel = normalizeRemotePath(relative(this.root, path).split(sep).join("/"));
        const content = await readFile(path);
        objects.push({
          path:rel,
          bytes:content.byteLength,
          sha256:sha256(content),
          content,
        });
      }
    }
    return objects.sort((a, b) => a.path.localeCompare(b.path));
  }

  async runSerialized(operation) {
    const previous = this.queue.catch(() => {});
    const current = previous.then(operation);
    this.queue = current;
    try {
      return await current;
    } finally {
      if (this.queue === current) this.queue = Promise.resolve();
    }
  }

  async flush() {
    return this.runSerialized(async () => {
      const [local, remote] = await Promise.all([this.scanLocal(), this.remoteManifest()]);
      const remoteByPath = new Map(remote.map((item) => [item.path, item]));
      let uploadedObjects = 0;
      let uploadedChunks = 0;
      let deletedObjects = 0;

      for (const object of local) {
        const existing = remoteByPath.get(object.path);
        if (
          existing &&
          existing.sha256 === object.sha256 &&
          existing.bytes === object.bytes
        ) {
          remoteByPath.delete(object.path);
          continue;
        }

        const chunks = Math.max(1, Math.ceil(object.bytes / this.chunkBytes));
        for (let index = 0; index < chunks; index += 1) {
          const start = index * this.chunkBytes;
          const end = Math.min(object.bytes, start + this.chunkBytes);
          const chunk = object.content.subarray(start, end);
          await this.request({
            action:"forge_state_put_chunk",
            path:object.path,
            objectSha256:object.sha256,
            index,
            bytes:chunk.byteLength,
            sha256:sha256(chunk),
            contentBase64:chunk.toString("base64"),
          });
          uploadedChunks += 1;
        }
        await this.request({
          action:"forge_state_commit_object",
          path:object.path,
          bytes:object.bytes,
          sha256:object.sha256,
          chunks,
        });
        uploadedObjects += 1;
        remoteByPath.delete(object.path);
      }

      for (const stale of remoteByPath.values()) {
        await this.request({action:"forge_state_delete_object", path:stale.path});
        deletedObjects += 1;
      }

      const verifiedRemote = await this.remoteManifest();
      const localManifest = local.map(({path,bytes,sha256:digest}) => ({
        path,bytes,sha256:digest,
      }));
      const remoteManifest = verifiedRemote.map(({path,bytes,sha256:digest}) => ({
        path,bytes,sha256:digest,
      }));
      if (JSON.stringify(localManifest) !== JSON.stringify(remoteManifest)) {
        throw new Error("durable state remote manifest verification failed");
      }

      return {
        verified:true,
        objects:local.length,
        uploadedObjects,
        uploadedChunks,
        deletedObjects,
      };
    });
  }

  async hydrate() {
    return this.runSerialized(async () => {
      const manifest = await this.remoteManifest();
      const stage = join(this.root, ".durable-hydrate-" + randomUUID());
      await mkdir(stage, {recursive:true});

      try {
        for (const object of manifest) {
          const parts = [];
          let totalBytes = 0;
          for (let index = 0; index < object.chunks; index += 1) {
            const response = await this.request({
              action:"forge_state_get_chunk",
              path:object.path,
              objectSha256:object.sha256,
              index,
            });
            const remoteChunk = response?.chunk;
            if (!remoteChunk || Number(remoteChunk.index) !== index) {
              throw new Error("durable state chunk identity mismatch");
            }
            const content = Buffer.from(String(remoteChunk.contentBase64 ?? ""), "base64");
            const expectedBytes = Number(remoteChunk.bytes);
            const expectedSha = String(remoteChunk.sha256 ?? "");
            if (
              content.byteLength !== expectedBytes ||
              !SHA256.test(expectedSha) ||
              sha256(content) !== expectedSha
            ) {
              throw new Error("durable state chunk integrity mismatch");
            }
            parts.push(content);
            totalBytes += content.byteLength;
            if (totalBytes > this.maxObjectBytes) {
              throw Object.assign(new Error("durable state object exceeds maximum size"), {statusCode:413});
            }
          }

          const content = Buffer.concat(parts, totalBytes);
          if (content.byteLength !== object.bytes || sha256(content) !== object.sha256) {
            throw new Error("durable state object integrity mismatch");
          }
          const target = assertInside(stage, join(stage, ...object.path.split("/")));
          await mkdir(dirname(target), {recursive:true});
          await writeFile(target, content, {mode:0o600});
        }

        for (const managedRoot of MANAGED_ROOTS) {
          const live = join(this.root, managedRoot);
          const hydrated = join(stage, managedRoot);
          await rm(live, {recursive:true, force:true});
          try {
            await rename(hydrated, live);
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
          }
        }

        return {
          verified:true,
          objects:manifest.length,
          bytes:manifest.reduce((sum, item) => sum + item.bytes, 0),
        };
      } finally {
        await rm(stage, {recursive:true, force:true});
      }
    });
  }

  async status() {
    const body = await this.request({action:"forge_state_status"});
    if (
      body?.ok !== true ||
      body?.schema !== "sauceapproved.hercules.forge.durable-state.v1" ||
      body?.carriesCredentials !== false
    ) {
      throw new Error("durable state status verification failed");
    }
    const objectCount = Number(body.objectCount ?? 0);
    if (!Number.isSafeInteger(objectCount) || objectCount < 0) {
      throw new Error("durable state object count is invalid");
    }
    return {
      ok:true,
      schema:body.schema,
      carriesCredentials:false,
      endpoint:new URL(this.endpoint).origin,
      objectCount,
    };
  }
}

export const FORGE_DURABLE_STATE_MANAGED_ROOTS = MANAGED_ROOTS;
