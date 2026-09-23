import {createHash, randomUUID} from "node:crypto";
import {copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile} from "node:fs/promises";
import {dirname, join, relative, resolve, sep} from "node:path";

const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SNAPSHOT_VERSION = "0.1";
export const DEFAULT_RUNTIME_DATA_MAX_BYTES = 50 * 1024 * 1024;

function assertId(label, value) {
  if (!ID.test(String(value ?? ""))) {
    throw new Error(label + " must be a path-safe identifier");
  }
  return String(value);
}

function assertInside(root, target) {
  const base = resolve(root);
  const resolved = resolve(target);
  const rel = relative(base, resolved);
  if (rel === "" || (!rel.startsWith(".." + sep) && rel !== "..")) return resolved;
  throw new Error("runtime data path escapes root");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listDataFiles(root) {
  let entries;
  try {
    entries = await readdir(root, {withFileTypes: true});
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile()) {
      throw new Error("unexpected runtime data entry: " + entry.name);
    }
    if (!entry.name.endsWith(".json")) {
      throw new Error("unexpected runtime data file: " + entry.name);
    }
    files.push(entry.name);
  }
  return files;
}

function snapshotFingerprint(manifest) {
  return sha256(JSON.stringify({
    snapshotVersion: manifest.snapshotVersion,
    projectId: manifest.projectId,
    snapshotId: manifest.snapshotId,
    files: manifest.files,
    totalBytes: manifest.totalBytes,
  }));
}

export class ForgeRuntimeDataAdapter {
  async usage() {
    throw new Error("ForgeRuntimeDataAdapter.usage not implemented");
  }

  async listSnapshots() {
    throw new Error("ForgeRuntimeDataAdapter.listSnapshots not implemented");
  }

  async createSnapshot() {
    throw new Error("ForgeRuntimeDataAdapter.createSnapshot not implemented");
  }

  async verifySnapshot() {
    throw new Error("ForgeRuntimeDataAdapter.verifySnapshot not implemented");
  }

  async restoreSnapshot() {
    throw new Error("ForgeRuntimeDataAdapter.restoreSnapshot not implemented");
  }
}

export class ForgeLocalRuntimeDataAdapter extends ForgeRuntimeDataAdapter {
  constructor(root, {maxProjectBytes = DEFAULT_RUNTIME_DATA_MAX_BYTES} = {}) {
    super();
    if (!root) throw new TypeError("root is required");
    if (!Number.isSafeInteger(maxProjectBytes) || maxProjectBytes < 1024) {
      throw new TypeError("maxProjectBytes must be an integer >= 1024");
    }
    this.root = root;
    this.maxProjectBytes = maxProjectBytes;
  }

  projectDataDir(projectId) {
    projectId = assertId("projectId", projectId);
    return assertInside(join(this.root, "runtime-data"), join(this.root, "runtime-data", projectId));
  }

  snapshotDir(projectId, snapshotId) {
    projectId = assertId("projectId", projectId);
    snapshotId = assertId("snapshotId", snapshotId);
    return assertInside(
      join(this.root, "runtime-snapshots"),
      join(this.root, "runtime-snapshots", projectId, snapshotId),
    );
  }

  async usage(projectId) {
    const dataDir = this.projectDataDir(projectId);
    const files = await listDataFiles(dataDir);
    let totalBytes = 0;
    for (const file of files) {
      const info = await stat(join(dataDir, file));
      totalBytes += info.size;
    }
    return {
      projectId: assertId("projectId", projectId),
      files: files.length,
      totalBytes,
      maxBytes: this.maxProjectBytes,
      remainingBytes: Math.max(0, this.maxProjectBytes - totalBytes),
      overLimit: totalBytes > this.maxProjectBytes,
    };
  }

  async listSnapshots(projectId) {
    projectId = assertId("projectId", projectId);
    const root = join(this.root, "runtime-snapshots", projectId);
    let entries;
    try {
      entries = await readdir(root, {withFileTypes: true});
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }

    const snapshots = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID.test(entry.name)) continue;
      try {
        snapshots.push(await readJson(join(root, entry.name, "snapshot.json")));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSnapshot(projectId, {snapshotId = randomUUID()} = {}) {
    projectId = assertId("projectId", projectId);
    snapshotId = assertId("snapshotId", snapshotId);
    const dataDir = this.projectDataDir(projectId);
    const finalDir = this.snapshotDir(projectId, snapshotId);
    const parent = dirname(finalDir);
    const tempDir = join(parent, "." + snapshotId + ".tmp-" + randomUUID());
    await mkdir(join(tempDir, "data"), {recursive: true});

    try {
      const files = {};
      let totalBytes = 0;
      for (const name of await listDataFiles(dataDir)) {
        const content = await readFile(join(dataDir, name));
        await copyFile(join(dataDir, name), join(tempDir, "data", name));
        files[name] = {sha256: sha256(content), bytes: content.byteLength};
        totalBytes += content.byteLength;
      }

      const manifest = {
        snapshotVersion: SNAPSHOT_VERSION,
        projectId,
        snapshotId,
        createdAt: new Date().toISOString(),
        files,
        totalBytes,
        maxBytes: this.maxProjectBytes,
      };
      manifest.snapshotFingerprint = snapshotFingerprint(manifest);
      await writeFile(join(tempDir, "snapshot.json"), json(manifest), "utf8");
      await mkdir(parent, {recursive: true});
      await rename(tempDir, finalDir);
      return await this.verifySnapshot(projectId, snapshotId);
    } catch (error) {
      await rm(tempDir, {recursive: true, force: true});
      throw error;
    }
  }

  async verifySnapshot(projectId, snapshotId) {
    projectId = assertId("projectId", projectId);
    snapshotId = assertId("snapshotId", snapshotId);
    const dir = this.snapshotDir(projectId, snapshotId);
    const manifest = await readJson(join(dir, "snapshot.json"));

    if (
      manifest.snapshotVersion !== SNAPSHOT_VERSION ||
      manifest.projectId !== projectId ||
      manifest.snapshotId !== snapshotId
    ) {
      throw new Error("runtime snapshot identity mismatch");
    }

    const actualFiles = await listDataFiles(join(dir, "data"));
    const expectedFiles = Object.keys(manifest.files ?? {}).sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      throw new Error("runtime snapshot file set mismatch");
    }

    let totalBytes = 0;
    for (const [name, expected] of Object.entries(manifest.files ?? {})) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}\.json$/.test(name)) {
        throw new Error("unsafe runtime snapshot file: " + name);
      }
      const content = await readFile(join(dir, "data", name));
      const actual = sha256(content);
      if (actual !== expected.sha256 || content.byteLength !== expected.bytes) {
        throw new Error("runtime snapshot verification failed: " + name);
      }
      totalBytes += content.byteLength;
    }

    if (totalBytes !== manifest.totalBytes) {
      throw new Error("runtime snapshot byte count mismatch");
    }
    if (manifest.snapshotFingerprint !== snapshotFingerprint(manifest)) {
      throw new Error("runtime snapshot fingerprint mismatch");
    }
    return {...manifest, verified: true};
  }

  async restoreSnapshot(projectId, snapshotId) {
    projectId = assertId("projectId", projectId);
    snapshotId = assertId("snapshotId", snapshotId);
    const manifest = await this.verifySnapshot(projectId, snapshotId);
    if (manifest.totalBytes > this.maxProjectBytes) {
      throw Object.assign(new Error("runtime data quota exceeded"), {statusCode: 413});
    }

    const sourceDir = join(this.snapshotDir(projectId, snapshotId), "data");
    const runtimeRoot = join(this.root, "runtime-data");
    const dataDir = this.projectDataDir(projectId);
    const tempDir = join(runtimeRoot, "." + projectId + ".restore-" + randomUUID());
    const previousDir = join(runtimeRoot, "." + projectId + ".previous-" + randomUUID());
    await mkdir(tempDir, {recursive: true});

    let previousMoved = false;
    let restoreActivated = false;
    try {
      for (const name of Object.keys(manifest.files)) {
        await copyFile(join(sourceDir, name), join(tempDir, name));
      }

      if (await exists(dataDir)) {
        await rename(dataDir, previousDir);
        previousMoved = true;
      }

      try {
        await rename(tempDir, dataDir);
        restoreActivated = true;
      } catch (error) {
        if (previousMoved) {
          await rename(previousDir, dataDir);
          previousMoved = false;
        }
        throw error;
      }

      if (previousMoved) {
        await rm(previousDir, {recursive: true, force: true});
        previousMoved = false;
      }
      return {
        projectId,
        snapshotId,
        restored: true,
        verified: true,
        totalBytes: manifest.totalBytes,
        files: Object.keys(manifest.files).length,
      };
    } finally {
      if (!restoreActivated) await rm(tempDir, {recursive: true, force: true});
      if (!previousMoved) await rm(previousDir, {recursive: true, force: true});
    }
  }
}
