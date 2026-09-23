import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  DEFAULT_RUNTIME_DATA_MAX_BYTES,
  ForgeLocalRuntimeDataAdapter,
  ForgeRuntimeDataAdapter,
} from "../hercules-forge/runtime-data.mjs";

test("runtime data adapter contract fails closed when not implemented", async () => {
  const adapter = new ForgeRuntimeDataAdapter();
  await assert.rejects(adapter.usage(), /not implemented/);
  await assert.rejects(adapter.createSnapshot(), /not implemented/);
  await assert.rejects(adapter.restoreSnapshot(), /not implemented/);
});

test("local runtime data snapshots verify and restore exact project data", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-runtime-data-"));
  try {
    const adapter = new ForgeLocalRuntimeDataAdapter(root);
    const dataDir = join(root, "runtime-data", "project-a");
    await mkdir(dataDir, {recursive: true});
    const original = JSON.stringify({
      item1: {id: "item1", name: "original"},
    }, null, 2) + "\n";
    await writeFile(join(dataDir, "Item.json"), original, "utf8");

    const usage = await adapter.usage("project-a");
    assert.equal(usage.files, 1);
    assert.equal(usage.totalBytes, Buffer.byteLength(original));
    assert.equal(usage.maxBytes, DEFAULT_RUNTIME_DATA_MAX_BYTES);
    assert.equal(usage.overLimit, false);

    const snapshot = await adapter.createSnapshot("project-a", {snapshotId: "snapshot-one"});
    assert.equal(snapshot.verified, true);
    assert.equal(snapshot.projectId, "project-a");
    assert.equal(snapshot.snapshotId, "snapshot-one");
    assert.match(snapshot.snapshotFingerprint, /^[a-f0-9]{64}$/);

    const listed = await adapter.listSnapshots("project-a");
    assert.equal(listed.length, 1);
    assert.equal(listed[0].snapshotId, "snapshot-one");

    await writeFile(
      join(dataDir, "Item.json"),
      JSON.stringify({item2: {id: "item2", name: "changed"}}, null, 2) + "\n",
      "utf8",
    );

    const restored = await adapter.restoreSnapshot("project-a", "snapshot-one");
    assert.equal(restored.restored, true);
    assert.equal(restored.verified, true);
    assert.equal(await readFile(join(dataDir, "Item.json"), "utf8"), original);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("snapshot verification rejects tampering and unexpected files", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-runtime-tamper-"));
  try {
    const adapter = new ForgeLocalRuntimeDataAdapter(root);
    const dataDir = join(root, "runtime-data", "project-b");
    await mkdir(dataDir, {recursive: true});
    await writeFile(join(dataDir, "Item.json"), '{"a":{"id":"a"}}\n', "utf8");
    await adapter.createSnapshot("project-b", {snapshotId: "snapshot-tamper"});

    const snapshotData = join(
      root,
      "runtime-snapshots",
      "project-b",
      "snapshot-tamper",
      "data",
    );
    await writeFile(join(snapshotData, "Extra.json"), "{}\n", "utf8");
    await assert.rejects(
      adapter.verifySnapshot("project-b", "snapshot-tamper"),
      /file set mismatch/,
    );
    await rm(join(snapshotData, "Extra.json"));

    await writeFile(join(snapshotData, "Item.json"), '{"tampered":true}\n', "utf8");
    await assert.rejects(
      adapter.verifySnapshot("project-b", "snapshot-tamper"),
      /verification failed/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("restore refuses a verified snapshot above the configured project quota", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-runtime-quota-"));
  try {
    const source = new ForgeLocalRuntimeDataAdapter(root, {maxProjectBytes: 8192});
    const dataDir = join(root, "runtime-data", "project-c");
    await mkdir(dataDir, {recursive: true});
    await writeFile(
      join(dataDir, "Item.json"),
      JSON.stringify({item: {id: "item", payload: "x".repeat(3000)}}, null, 2) + "\n",
      "utf8",
    );
    const snapshot = await source.createSnapshot("project-c", {snapshotId: "large-snapshot"});
    assert.ok(snapshot.totalBytes > 1024);

    const constrained = new ForgeLocalRuntimeDataAdapter(root, {maxProjectBytes: 1024});
    await assert.rejects(
      constrained.restoreSnapshot("project-c", "large-snapshot"),
      (error) => error?.statusCode === 413 && /quota exceeded/.test(error.message),
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("runtime data adapter rejects path-unsafe project and snapshot identifiers", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-runtime-safe-"));
  try {
    const adapter = new ForgeLocalRuntimeDataAdapter(root);
    await assert.rejects(adapter.usage("../escape"), /path-safe identifier/);
    await assert.rejects(
      adapter.createSnapshot("safe-project", {snapshotId: "../escape"}),
      /path-safe identifier/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
