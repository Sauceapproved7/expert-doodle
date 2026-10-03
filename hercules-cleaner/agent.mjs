import {randomUUID} from "node:crypto";
import {statfs} from "node:fs/promises";
import {
  captureSessionSnapshot,
  createCleanupPlan,
  diffSessionSnapshots,
  executeCleanupPlan,
  listRecoveryCapsules,
  purgeExpiredCapsules,
  restoreRecoveryCapsule,
} from "./engine.mjs";
import {shouldRunSchedule} from "./scheduler.mjs";
import {
  acquireCleanerLock,
  loadConfig,
  loadRuntime,
  loadSessionSnapshot,
  removeSessionSnapshot,
  saveConfig,
  saveRuntime,
  saveSessionSnapshot,
  statePaths,
} from "./state.mjs";

function findProfile(config, profileId) {
  const id = profileId || config.activeProfileId;
  const profile = config.profiles.find((item) => item.id === id);
  if (!profile) throw new Error(`unknown cleanup profile: ${id}`);
  return profile;
}

export async function getCleanerStatus(options = {}) {
  const config = await loadConfig(options);
  const runtime = await loadRuntime(options);
  const capsules = await listRecoveryCapsules({vaultRoot: statePaths(options).vault});
  return {
    product: "Hercules Cleaner",
    version: 1,
    activeProfileId: config.activeProfileId,
    profiles: config.profiles.map(({id, name, description, schedule}) => ({id, name, description, schedule})),
    lastRuns: runtime.lastRuns,
    activeSessions: Object.values(runtime.activeSessions ?? {}),
    recoveryCapsules: capsules.map(({id, state, createdAt, expiresAt, recoveredBytes, items = []}) => ({id, state, createdAt, expiresAt, recoveredBytes, itemCount: items.length})),
  };
}

export async function scanComputer({profileId, now = Date.now(), ...options} = {}) {
  const config = await loadConfig(options);
  const profile = findProfile(config, profileId);
  return createCleanupPlan({profile, now});
}

export async function cleanComputer({profileId, now = Date.now(), ...options} = {}) {
  const release = await acquireCleanerLock(options);
  try {
    const config = await loadConfig(options);
    const profile = findProfile(config, profileId);
    const plan = await createCleanupPlan({profile, now});
    const result = await executeCleanupPlan({
      plan,
      vaultRoot: statePaths(options).vault,
      retentionMs: profile.recoveryRetentionMs,
      now,
    });
    const runtime = await loadRuntime(options);
    runtime.lastRuns[profile.id] = now;
    await saveRuntime(runtime, options);
    return {...result, plan};
  } finally {
    await release();
  }
}

export async function startWorkSession({profileId = "after-work", label = "work", now = Date.now(), ...options} = {}) {
  const config = await loadConfig(options);
  const profile = findProfile(config, profileId);
  const snapshot = await captureSessionSnapshot({profile, now});
  const id = `session-${randomUUID()}`;
  await saveSessionSnapshot(id, {id, label, profileId: profile.id, startedAt: now, snapshot}, options);
  const runtime = await loadRuntime(options);
  runtime.activeSessions ??= {};
  runtime.activeSessions[id] = {id, label, profileId: profile.id, startedAt: now};
  await saveRuntime(runtime, options);
  return runtime.activeSessions[id];
}

export async function stopWorkSession({sessionId, apply = true, now = Date.now(), ...options} = {}) {
  if (!sessionId) throw new Error("sessionId is required");
  const config = await loadConfig(options);
  const saved = await loadSessionSnapshot(sessionId, options);
  const profile = findProfile(config, saved.profileId);
  const after = await captureSessionSnapshot({profile, now});
  const diff = diffSessionSnapshots({before: saved.snapshot, after, profile, now});
  const plan = {
    schema: "sauceapproved.hercules-cleaner.plan",
    version: 1,
    profileId: profile.id,
    createdAt: new Date(now).toISOString(),
    candidates: diff.candidates,
    skipped: diff.skipped,
    reclaimableBytes: diff.reclaimableBytes,
    destructive: false,
    executionMode: "recovery-capsule",
    source: "session-diff",
    sessionId,
  };
  let execution = null;
  if (apply && plan.candidates.length > 0) {
    const release = await acquireCleanerLock(options);
    try {
      execution = await executeCleanupPlan({plan, vaultRoot: statePaths(options).vault, retentionMs: profile.recoveryRetentionMs, now});
    } finally {
      await release();
    }
  }
  const runtime = await loadRuntime(options);
  if (runtime.activeSessions) delete runtime.activeSessions[sessionId];
  if (apply) runtime.lastRuns[profile.id] = now;
  await saveRuntime(runtime, options);
  await removeSessionSnapshot(sessionId, options);
  return {plan, execution};
}

export async function restoreCapsule({capsuleId, ...options} = {}) {
  const release = await acquireCleanerLock(options);
  try {
    return restoreRecoveryCapsule({vaultRoot: statePaths(options).vault, capsuleId});
  } finally {
    await release();
  }
}

export async function setProfileSchedule({profileId, schedule, ...options} = {}) {
  const config = await loadConfig(options);
  const profile = findProfile(config, profileId);
  const allowed = new Set(["daily", "weekly", "everyNDays", "afterSession", "lowStorage", "hourly"]);
  if (!schedule || !allowed.has(schedule.type)) throw new Error("unsupported schedule type");
  if (schedule.type === "everyNDays" && (!Number.isInteger(Number(schedule.days)) || Number(schedule.days) < 1 || Number(schedule.days) > 365)) throw new Error("days must be between 1 and 365");
  if (schedule.type === "hourly" && (!Number.isInteger(Number(schedule.hours)) || Number(schedule.hours) < 1 || Number(schedule.hours) > 168)) throw new Error("hours must be between 1 and 168");
  if (schedule.type === "lowStorage" && (Number(schedule.freePercentBelow) < 5 || Number(schedule.freePercentBelow) > 50)) throw new Error("freePercentBelow must be between 5 and 50");
  profile.schedule = {...schedule, enabled: schedule.enabled !== false};
  await saveConfig(config, options);
  return {profileId: profile.id, schedule: profile.schedule};
}

async function freePercentForPath(path) {
  const stats = await statfs(path);
  const total = Number(stats.blocks) * Number(stats.bsize);
  const free = Number(stats.bavail) * Number(stats.bsize);
  return total > 0 ? (free / total) * 100 : 100;
}

export async function runScheduledPass({now = Date.now(), ...options} = {}) {
  const config = await loadConfig(options);
  const runtime = await loadRuntime(options);
  const results = [];
  await purgeExpiredCapsules({vaultRoot: statePaths(options).vault, now});
  for (const profile of config.profiles) {
    const schedule = profile.schedule;
    if (!schedule?.enabled || schedule.type === "afterSession") continue;
    let due = shouldRunSchedule({schedule, lastRunAt: runtime.lastRuns?.[profile.id], now});
    if (schedule.type === "lowStorage") {
      const root = profile.roots[0];
      const freePercent = await freePercentForPath(root).catch(() => 100);
      due = freePercent < Number(schedule.freePercentBelow ?? 15);
    }
    if (!due) continue;
    const result = await cleanComputer({profileId: profile.id, now, ...options});
    results.push({profileId: profile.id, cleanedFiles: result.cleanedFiles, reclaimedBytes: result.reclaimedBytes});
  }
  return results;
}

export async function runDaemon(options = {}) {
  const config = await loadConfig(options);
  const pollMs = Math.max(30_000, Number(config.daemon?.pollMs ?? 60_000));
  for (;;) {
    await runScheduledPass(options).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
