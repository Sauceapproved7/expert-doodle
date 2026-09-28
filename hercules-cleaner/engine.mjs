import {createHash, randomUUID} from "node:crypto";
import {access, copyFile, lstat, mkdir, open, readdir, readFile, rename, rm, stat, unlink, writeFile} from "node:fs/promises";
import {basename, dirname, extname, join, resolve, sep} from "node:path";

const DEFAULT_MAX_FILES = 20_000;
const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function resolved(value) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError("path must be a non-empty string");
  return resolve(value);
}

function isWithin(path, root) {
  const p = resolved(path);
  const r = resolved(root);
  return p === r || p.startsWith(`${r}${sep}`);
}

function isProtected(path, protectedPaths = []) {
  return protectedPaths.some((root) => isWithin(path, root));
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") throw new TypeError("profile is required");
  const roots = [...new Set((profile.roots ?? []).map(resolved))];
  if (roots.length === 0) throw new Error("profile must include at least one cleanup root");
  return {
    id: String(profile.id ?? "default"),
    roots,
    protectedPaths: [...new Set((profile.protectedPaths ?? []).map(resolved))],
    disposableExtensions: [...new Set((profile.disposableExtensions ?? []).map((value) => String(value).toLowerCase()))],
    disposableNames: [...new Set((profile.disposableNames ?? []).map((value) => String(value).toLowerCase()))],
    cleanAllInRoots: [...new Set((profile.cleanAllInRoots ?? []).map(resolved))],
    minAgeMs: Math.max(0, Number(profile.minAgeMs ?? 24 * 60 * 60 * 1000)),
    maxFileBytes: Math.max(1, Number(profile.maxFileBytes ?? Number.MAX_SAFE_INTEGER)),
    maxFiles: Math.max(1, Number(profile.maxFiles ?? DEFAULT_MAX_FILES)),
    maxDepth: Math.max(0, Number(profile.maxDepth ?? DEFAULT_MAX_DEPTH)),
  };
}

function matchDisposable(path, profile) {
  const name = basename(path).toLowerCase();
  const extension = extname(name);
  return profile.cleanAllInRoots.some((root) => isWithin(path, root))
    || profile.disposableNames.includes(name)
    || profile.disposableExtensions.includes(extension);
}

function assessFile({path, size, mtimeMs}, profile, now, {ignoreAge = false} = {}) {
  if (!profile.roots.some((root) => isWithin(path, root))) return {allowed: false, reason: "outside-approved-root"};
  if (isProtected(path, profile.protectedPaths)) return {allowed: false, reason: "protected-path"};
  if (!matchDisposable(path, profile)) return {allowed: false, reason: "not-disposable-by-policy"};
  if (size > profile.maxFileBytes) return {allowed: false, reason: "file-too-large-for-policy"};
  if (!ignoreAge && profile.minAgeMs > 0 && now - mtimeMs < profile.minAgeMs) return {allowed: false, reason: "too-recent"};
  return {allowed: true, reason: "approved-disposable-artifact"};
}

async function walkRoot(root, profile, visitor, depth = 0, counter = {files: 0}) {
  if (depth > profile.maxDepth || counter.files >= profile.maxFiles) return;
  let entries;
  try {
    entries = await readdir(root, {withFileTypes: true});
  } catch (error) {
    visitor({path: root, inaccessible: true, error: error?.code ?? "READ_FAILED"});
    return;
  }
  for (const entry of entries) {
    if (counter.files >= profile.maxFiles) return;
    const path = join(root, entry.name);
    let info;
    try {
      info = await lstat(path);
    } catch (error) {
      visitor({path, inaccessible: true, error: error?.code ?? "STAT_FAILED"});
      continue;
    }
    if (info.isSymbolicLink()) {
      visitor({path, skipped: true, reason: "symlink"});
      continue;
    }
    if (info.isDirectory()) {
      await walkRoot(path, profile, visitor, depth + 1, counter);
      continue;
    }
    if (!info.isFile()) continue;
    counter.files += 1;
    visitor({path, size: info.size, mtimeMs: info.mtimeMs});
  }
}

export async function createCleanupPlan({profile: rawProfile, now = Date.now()} = {}) {
  const profile = normalizeProfile(rawProfile);
  const candidates = [];
  const skipped = [];
  for (const root of profile.roots) {
    await walkRoot(root, profile, (item) => {
      if (item.inaccessible || item.skipped) {
        skipped.push(item);
        return;
      }
      const assessment = assessFile(item, profile, now);
      const record = {...item, reason: assessment.reason};
      if (assessment.allowed) candidates.push(record);
      else skipped.push(record);
    });
  }
  candidates.sort((a, b) => a.path.localeCompare(b.path));
  skipped.sort((a, b) => a.path.localeCompare(b.path));
  return {
    schema: "sauceapproved.hercules-cleaner.plan",
    version: 1,
    profileId: profile.id,
    createdAt: new Date(now).toISOString(),
    candidates,
    skipped,
    reclaimableBytes: candidates.reduce((sum, item) => sum + item.size, 0),
    destructive: false,
    executionMode: "recovery-capsule",
  };
}

export async function captureSessionSnapshot({profile: rawProfile, now = Date.now()} = {}) {
  const profile = normalizeProfile(rawProfile);
  const files = {};
  for (const root of profile.roots) {
    await walkRoot(root, profile, (item) => {
      if (item.inaccessible || item.skipped) return;
      if (isProtected(item.path, profile.protectedPaths)) return;
      files[item.path] = {size: item.size, mtimeMs: item.mtimeMs};
    });
  }
  return {
    schema: "sauceapproved.hercules-cleaner.session-snapshot",
    version: 1,
    profileId: profile.id,
    capturedAt: new Date(now).toISOString(),
    files,
  };
}

export function diffSessionSnapshots({before, after, profile: rawProfile, now = Date.now()} = {}) {
  const profile = normalizeProfile(rawProfile);
  if (!before?.files || !after?.files) throw new TypeError("before and after snapshots are required");
  const candidates = [];
  const skipped = [];
  for (const [path, current] of Object.entries(after.files)) {
    const previous = before.files[path];
    const changed = !previous || previous.size !== current.size || previous.mtimeMs !== current.mtimeMs;
    if (!changed) continue;
    const assessment = assessFile({path, ...current}, profile, now, {ignoreAge: true});
    const record = {path, ...current, reason: assessment.reason, sessionChange: previous ? "modified" : "created"};
    if (assessment.allowed) candidates.push(record);
    else skipped.push(record);
  }
  candidates.sort((a, b) => a.path.localeCompare(b.path));
  return {
    schema: "sauceapproved.hercules-cleaner.session-diff",
    version: 1,
    profileId: profile.id,
    candidates,
    skipped,
    reclaimableBytes: candidates.reduce((sum, item) => sum + item.size, 0),
  };
}

async function sha256File(path) {
  const handle = await open(path, "r");
  const hash = createHash("sha256");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close().catch(() => {});
  }
  return hash.digest("hex");
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), {recursive: true});
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  await rename(temp, path);
}

async function moveFile(source, destination) {
  await mkdir(dirname(destination), {recursive: true});
  try {
    await rename(source, destination);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    await copyFile(source, destination);
    await unlink(source);
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function executeCleanupPlan({plan, vaultRoot, retentionMs = DEFAULT_RETENTION_MS, now = Date.now()} = {}) {
  if (!plan || plan.schema !== "sauceapproved.hercules-cleaner.plan") throw new TypeError("valid cleanup plan is required");
  if (!Array.isArray(plan.candidates)) throw new TypeError("plan candidates are required");
  const vault = resolved(vaultRoot);
  const capsuleId = `hc-${new Date(now).toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const capsuleDir = join(vault, capsuleId);
  await mkdir(join(capsuleDir, "items"), {recursive: true, mode: 0o700});

  const capsule = {
    schema: "sauceapproved.hercules-cleaner.recovery-capsule",
    version: 1,
    id: capsuleId,
    profileId: plan.profileId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + Math.max(1, retentionMs)).toISOString(),
    state: "preparing",
    items: [],
    recoveredBytes: 0,
  };
  await atomicJson(join(capsuleDir, "manifest.json"), capsule);

  const moved = [];
  try {
    for (let index = 0; index < plan.candidates.length; index += 1) {
      const candidate = plan.candidates[index];
      const current = await stat(candidate.path);
      if (!current.isFile()) throw new Error(`candidate is no longer a file: ${candidate.path}`);
      if (current.size !== candidate.size || Math.abs(current.mtimeMs - candidate.mtimeMs) > 1) {
        throw new Error(`candidate changed after scan: ${candidate.path}`);
      }
      const sha256 = await sha256File(candidate.path);
      const fileName = `${String(index).padStart(5, "0")}-${sha256.slice(0, 16)}${extname(candidate.path)}`;
      const storedRelativePath = join("items", fileName);
      const storedPath = join(capsuleDir, storedRelativePath);
      await moveFile(candidate.path, storedPath);
      const item = {
        originalPath: resolved(candidate.path),
        storedRelativePath,
        sha256,
        size: candidate.size,
        mtimeMs: candidate.mtimeMs,
      };
      capsule.items.push(item);
      capsule.recoveredBytes += candidate.size;
      moved.push({source: storedPath, destination: candidate.path});
    }
    capsule.state = "sealed";
    await atomicJson(join(capsuleDir, "manifest.json"), capsule);
    return {capsule, cleanedFiles: capsule.items.length, reclaimedBytes: capsule.recoveredBytes};
  } catch (error) {
    for (const item of moved.reverse()) {
      if (await pathExists(item.source)) {
        await mkdir(dirname(item.destination), {recursive: true});
        if (!(await pathExists(item.destination))) await moveFile(item.source, item.destination).catch(() => {});
      }
    }
    capsule.state = "rolled-back";
    capsule.error = error instanceof Error ? error.message : String(error);
    await atomicJson(join(capsuleDir, "manifest.json"), capsule).catch(() => {});
    throw error;
  }
}

export async function restoreRecoveryCapsule({vaultRoot, capsuleId} = {}) {
  if (!/^[a-zA-Z0-9-]+$/.test(String(capsuleId ?? ""))) throw new Error("invalid capsule id");
  const capsuleDir = join(resolved(vaultRoot), capsuleId);
  const manifestPath = join(capsuleDir, "manifest.json");
  const capsule = JSON.parse(await readFile(manifestPath, "utf8"));
  if (capsule.schema !== "sauceapproved.hercules-cleaner.recovery-capsule") throw new Error("invalid recovery capsule manifest");
  if (capsule.state !== "sealed") throw new Error(`capsule is not restorable from state: ${capsule.state}`);

  for (const item of capsule.items) {
    if (await pathExists(item.originalPath)) throw new Error(`restore destination already exists: ${item.originalPath}`);
    const storedPath = join(capsuleDir, item.storedRelativePath);
    if (!isWithin(storedPath, capsuleDir)) throw new Error("capsule path traversal blocked");
    const actualHash = await sha256File(storedPath);
    if (actualHash !== item.sha256) throw new Error(`capsule integrity check failed for ${item.originalPath}`);
  }

  let restored = 0;
  for (const item of capsule.items) {
    const storedPath = join(capsuleDir, item.storedRelativePath);
    await mkdir(dirname(item.originalPath), {recursive: true});
    await moveFile(storedPath, item.originalPath);
    restored += 1;
  }
  capsule.state = "restored";
  capsule.restoredAt = new Date().toISOString();
  await atomicJson(manifestPath, capsule);
  return {capsuleId, restored};
}

export async function listRecoveryCapsules({vaultRoot} = {}) {
  const vault = resolved(vaultRoot);
  let entries;
  try {
    entries = await readdir(vault, {withFileTypes: true});
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const capsules = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("hc-")) continue;
    try {
      const manifest = JSON.parse(await readFile(join(vault, entry.name, "manifest.json"), "utf8"));
      capsules.push(manifest);
    } catch {
      capsules.push({id: entry.name, state: "invalid-manifest"});
    }
  }
  return capsules.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export async function purgeExpiredCapsules({vaultRoot, now = Date.now()} = {}) {
  const capsules = await listRecoveryCapsules({vaultRoot});
  const purged = [];
  for (const capsule of capsules) {
    if (capsule.state !== "sealed") continue;
    const expires = Date.parse(capsule.expiresAt);
    if (!Number.isFinite(expires) || expires > now) continue;
    await rm(join(resolved(vaultRoot), capsule.id), {recursive: true, force: true});
    purged.push(capsule.id);
  }
  return {purged};
}

export const __private = Object.freeze({isWithin, normalizeProfile, assessFile, matchDisposable});
