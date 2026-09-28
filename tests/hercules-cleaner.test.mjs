import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, stat, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  createCleanupPlan,
  executeCleanupPlan,
  restoreRecoveryCapsule,
  captureSessionSnapshot,
  diffSessionSnapshots,
} from "../hercules-cleaner/engine.mjs";
import {shouldRunSchedule} from "../hercules-cleaner/scheduler.mjs";

async function tempRoot() {
  return mkdtemp(join(tmpdir(), "hercules-cleaner-test-"));
}

test("cleanup plan only selects approved disposable files inside configured roots", async () => {
  const root = await tempRoot();
  const allowed = join(root, "cache");
  const protectedDir = join(root, "cache", "protected");
  await mkdir(protectedDir, {recursive: true});
  await writeFile(join(allowed, "stale.tmp"), "junk");
  await writeFile(join(protectedDir, "keep.tmp"), "keep");
  const now = Date.now();

  const plan = await createCleanupPlan({
    profile: {
      id: "safe",
      roots: [allowed],
      protectedPaths: [protectedDir],
      minAgeMs: 0,
      disposableExtensions: [".tmp"],
      maxFiles: 100,
      maxDepth: 5,
    },
    now,
  });

  assert.deepEqual(plan.candidates.map((item) => item.path), [join(allowed, "stale.tmp")]);
  assert.equal(plan.skipped.some((item) => item.path === join(protectedDir, "keep.tmp")), true);
  await rm(root, {recursive: true, force: true});
});

test("cleanup is transactional: files move into a hashed recovery capsule and restore cleanly", async () => {
  const root = await tempRoot();
  const vaultRoot = join(root, ".vault");
  const cache = join(root, "cache");
  await mkdir(cache, {recursive: true});
  const target = join(cache, "render.tmp");
  await writeFile(target, "recover-me");

  const plan = await createCleanupPlan({
    profile:{id:"work", roots:[cache], protectedPaths:[], minAgeMs:0, disposableExtensions:[".tmp"]},
    now:Date.now(),
  });
  const result = await executeCleanupPlan({plan, vaultRoot, retentionMs:86_400_000, now:Date.now()});

  await assert.rejects(stat(target));
  assert.equal(result.capsule.items.length, 1);
  assert.match(result.capsule.items[0].sha256, /^[a-f0-9]{64}$/);
  const manifest = JSON.parse(await readFile(join(vaultRoot, result.capsule.id, "manifest.json"), "utf8"));
  assert.equal(manifest.state, "sealed");

  const restored = await restoreRecoveryCapsule({vaultRoot, capsuleId:result.capsule.id});
  assert.equal(restored.restored, 1);
  assert.equal(await readFile(target, "utf8"), "recover-me");
  await rm(root, {recursive: true, force: true});
});

test("Session Clean identifies only approved disposable artifacts created or changed during the work session", async () => {
  const root = await tempRoot();
  const cache = join(root, "cache");
  await mkdir(cache, {recursive:true});
  const oldFile = join(cache, "old.tmp");
  await writeFile(oldFile, "old");

  const profile = {id:"video-work", roots:[cache], protectedPaths:[], minAgeMs:0, disposableExtensions:[".tmp"], maxFiles:100, maxDepth:5};
  const before = await captureSessionSnapshot({profile});
  await new Promise((resolve)=>setTimeout(resolve, 10));
  const newFile = join(cache, "new.tmp");
  await writeFile(newFile, "new");
  const after = await captureSessionSnapshot({profile});
  const diff = diffSessionSnapshots({before, after, profile});

  assert.deepEqual(diff.candidates.map((item)=>item.path), [newFile]);
  await rm(root, {recursive:true, force:true});
});

test("every-other-day schedule runs only when two full days have elapsed", () => {
  const last = Date.parse("2026-09-26T10:00:00Z");
  assert.equal(shouldRunSchedule({schedule:{type:"everyNDays", days:2}, lastRunAt:last, now:Date.parse("2026-09-28T10:00:00Z")}), true);
  assert.equal(shouldRunSchedule({schedule:{type:"everyNDays", days:2}, lastRunAt:last, now:Date.parse("2026-09-27T23:59:59Z")}), false);
});
