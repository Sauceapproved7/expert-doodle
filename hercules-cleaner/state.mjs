import {randomUUID} from "node:crypto";
import {access, mkdir, open, readFile, rename, rm, stat, writeFile} from "node:fs/promises";
import {homedir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {createDefaultConfig} from "./defaults.mjs";

export function statePaths({home = homedir(), stateRoot} = {}) {
  const root = resolve(stateRoot || join(home, ".hercules-cleaner"));
  return {
    root,
    config: join(root, "config.json"),
    vault: join(root, "recovery-vault"),
    sessions: join(root, "sessions"),
    runtime: join(root, "runtime.json"),
    lock: join(root, "cleaner.lock"),
  };
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), {recursive: true, mode: 0o700});
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  await rename(temp, path);
}

export async function loadConfig(options = {}) {
  const paths = statePaths(options);
  try {
    const parsed = JSON.parse(await readFile(paths.config, "utf8"));
    if (parsed.schema !== "sauceapproved.hercules-cleaner.config") throw new Error("invalid Hercules Cleaner config schema");
    return parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const config = createDefaultConfig(options);
    await atomicJson(paths.config, config);
    return config;
  }
}

export async function saveConfig(config, options = {}) {
  if (config?.schema !== "sauceapproved.hercules-cleaner.config") throw new Error("invalid Hercules Cleaner config");
  await atomicJson(statePaths(options).config, config);
}

export async function loadRuntime(options = {}) {
  const path = statePaths(options).runtime;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return {lastRuns: {}, activeSessions: {}};
  }
}

export async function saveRuntime(runtime, options = {}) {
  await atomicJson(statePaths(options).runtime, runtime);
}

export async function saveSessionSnapshot(id, value, options = {}) {
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  await atomicJson(join(statePaths(options).sessions, `${safeId}.json`), value);
}

export async function loadSessionSnapshot(id, options = {}) {
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  return JSON.parse(await readFile(join(statePaths(options).sessions, `${safeId}.json`), "utf8"));
}

export async function removeSessionSnapshot(id, options = {}) {
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  await rm(join(statePaths(options).sessions, `${safeId}.json`), {force: true});
}

export async function acquireCleanerLock(options = {}) {
  const path = statePaths(options).lock;
  await mkdir(dirname(path), {recursive: true, mode: 0o700});
  try {
    const handle = await open(path, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({pid: process.pid, createdAt: new Date().toISOString()})}\n`);
    await handle.close();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const info = await stat(path).catch(() => null);
    if (info && Date.now() - info.mtimeMs > 30 * 60 * 1000) {
      await rm(path, {force: true});
      return acquireCleanerLock(options);
    }
    throw new Error("another Hercules Cleaner operation is already active");
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await rm(path, {force: true});
  };
}

export async function stateExists(options = {}) {
  try {
    await access(statePaths(options).root);
    return true;
  } catch {
    return false;
  }
}
