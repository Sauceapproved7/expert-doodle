import {homedir, platform as currentPlatform, tmpdir} from "node:os";
import {join, resolve} from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXTENSIONS = Object.freeze([".tmp", ".temp", ".cache", ".dmp", ".crash", ".bak", ".old", ".part"]);

function uniq(values) {
  return [...new Set(values.filter(Boolean).map((value) => resolve(value)))];
}

export function createDefaultProfiles({
  platform = currentPlatform(),
  home = homedir(),
  temp = tmpdir(),
  env = process.env,
} = {}) {
  const protectedPaths = uniq([
    join(home, "Documents"),
    join(home, "Desktop"),
    join(home, "Pictures"),
    join(home, "Videos"),
    join(home, "Music"),
    join(home, ".ssh"),
    join(home, ".gnupg"),
  ]);

  const browserCaches = [];
  const appCaches = [];
  if (platform === "win32") {
    const local = env.LOCALAPPDATA;
    if (local) {
      browserCaches.push(
        join(local, "Google", "Chrome", "User Data", "Default", "Cache"),
        join(local, "Microsoft", "Edge", "User Data", "Default", "Cache"),
        join(local, "BraveSoftware", "Brave-Browser", "User Data", "Default", "Cache"),
      );
      appCaches.push(join(local, "Temp"));
    }
  } else if (platform === "darwin") {
    appCaches.push(join(home, "Library", "Caches"));
    browserCaches.push(
      join(home, "Library", "Caches", "Google", "Chrome"),
      join(home, "Library", "Caches", "com.apple.Safari"),
      join(home, "Library", "Caches", "Microsoft Edge"),
    );
  } else {
    const xdgCache = env.XDG_CACHE_HOME || join(home, ".cache");
    appCaches.push(xdgCache);
    browserCaches.push(
      join(xdgCache, "google-chrome"),
      join(xdgCache, "chromium"),
      join(xdgCache, "mozilla", "firefox"),
    );
  }

  const safeRoots = uniq([temp, ...appCaches, ...browserCaches]);
  const cleanAllInRoots = uniq([...appCaches, ...browserCaches]);

  return [
    {
      id: "quick-safe",
      name: "Quick Safe",
      description: "User-scoped temporary and cache cleanup with recovery enabled.",
      roots: safeRoots,
      cleanAllInRoots,
      protectedPaths,
      disposableExtensions: EXTENSIONS,
      minAgeMs: 3 * DAY_MS,
      maxFileBytes: 2 * 1024 * 1024 * 1024,
      maxFiles: 20_000,
      maxDepth: 12,
      schedule: {type: "weekly", enabled: true},
      recoveryRetentionMs: 7 * DAY_MS,
    },
    {
      id: "after-work",
      name: "After Work",
      description: "Session-aware cleanup of disposable artifacts created during a tracked work session.",
      roots: safeRoots,
      cleanAllInRoots,
      protectedPaths,
      disposableExtensions: EXTENSIONS,
      minAgeMs: 0,
      maxFileBytes: 2 * 1024 * 1024 * 1024,
      maxFiles: 20_000,
      maxDepth: 12,
      schedule: {type: "afterSession", enabled: true},
      recoveryRetentionMs: 7 * DAY_MS,
    },
    {
      id: "low-storage",
      name: "Low Storage Guard",
      description: "Runs only when free disk space falls below a configured threshold.",
      roots: safeRoots,
      cleanAllInRoots,
      protectedPaths,
      disposableExtensions: EXTENSIONS,
      minAgeMs: DAY_MS,
      maxFileBytes: 4 * 1024 * 1024 * 1024,
      maxFiles: 30_000,
      maxDepth: 14,
      schedule: {type: "lowStorage", enabled: true, freePercentBelow: 15},
      recoveryRetentionMs: 3 * DAY_MS,
    },
  ];
}

export function createDefaultConfig(options = {}) {
  const profiles = createDefaultProfiles(options);
  return {
    schema: "sauceapproved.hercules-cleaner.config",
    version: 1,
    activeProfileId: "quick-safe",
    dashboard: {host: "127.0.0.1", port: 4777},
    daemon: {pollMs: 60_000, enabled: true},
    profiles,
  };
}
