import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeAuditStore} from "../hercules-forge/audit.mjs";

function fixtureValue(...parts) {
  return parts.join("-");
}

test("audit store appends a verified hash chain and filters recent events", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-audit-"));
  try {
    const audit = new ForgeAuditStore(root);
    const first = await audit.append({
      type: "session.login",
      actor: {kind: "user", userId: "user-a"},
      workspaceId: "workspace-a",
      details: {emailHash: "abc123"},
    });
    const second = await audit.append({
      type: "project.publish",
      actor: {kind: "user", userId: "user-a"},
      workspaceId: "workspace-a",
      projectId: "project-a",
      details: {revisionId: "rev-1"},
    });
    const third = await audit.append({
      type: "project.publish",
      actor: {kind: "control"},
      projectId: "project-b",
      details: {revisionId: "rev-2"},
    });

    assert.equal(first.sequence, 1);
    assert.equal(first.previousHash, null);
    assert.match(first.hash, /^[a-f0-9]{64}$/);
    assert.equal(second.sequence, 2);
    assert.equal(second.previousHash, first.hash);
    assert.equal(third.previousHash, second.hash);

    const verified = await audit.verify();
    assert.equal(verified.verified, true);
    assert.equal(verified.events, 3);
    assert.equal(verified.lastHash, third.hash);

    const workspaceEvents = await audit.list({workspaceId: "workspace-a"});
    assert.equal(workspaceEvents.length, 2);
    assert.equal(workspaceEvents[0].sequence, 2);

    const projectEvents = await audit.list({projectId: "project-a", type: "project.publish"});
    assert.equal(projectEvents.length, 1);
    assert.equal(projectEvents[0].details.revisionId, "rev-1");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("audit store serializes concurrent appends without sequence gaps", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-audit-concurrent-"));
  try {
    const audit = new ForgeAuditStore(root);
    const results = await Promise.all(
      Array.from({length: 20}, (_, index) =>
        audit.append({
          type: "project.revision",
          actor: {kind: "control"},
          projectId: "project-a",
          details: {index},
        }),
      ),
    );
    assert.deepEqual(
      results.map((event) => event.sequence),
      Array.from({length: 20}, (_, index) => index + 1),
    );
    const verified = await audit.verify();
    assert.equal(verified.events, 20);
    assert.equal(verified.lastSequence, 20);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("audit store rejects secret-shaped detail fields", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-audit-secrets-"));
  try {
    const audit = new ForgeAuditStore(root);
    await assert.rejects(
      audit.append({
        type: "session.login",
        actor: {kind: "system"},
        details: {password: fixtureValue("must", "not", "be", "recorded")},
      }),
      /secret-shaped field/,
    );
    await assert.rejects(
      audit.append({
        type: "session.login",
        actor: {kind: "system"},
        details: {nested: {csrfToken: fixtureValue("must", "not", "be", "recorded")}},
      }),
      /secret-shaped field/,
    );
    assert.equal((await audit.verify()).events, 0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("audit verification fails after line tampering", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-audit-tamper-"));
  try {
    const audit = new ForgeAuditStore(root);
    await audit.append({
      type: "project.snapshot",
      actor: {kind: "control"},
      projectId: "project-a",
      details: {snapshotId: "snapshot-a"},
    });
    await audit.append({
      type: "project.restore",
      actor: {kind: "control"},
      projectId: "project-a",
      details: {snapshotId: "snapshot-a"},
    });

    const path = join(root, "audit", "events.jsonl");
    const text = await readFile(path, "utf8");
    const tampered = text.replace('"snapshotId":"snapshot-a"', '"snapshotId":"snapshot-b"');
    await writeFile(path, tampered, "utf8");

    await assert.rejects(audit.verify(), /hash mismatch/);
    await assert.rejects(
      audit.append({
        type: "project.publish",
        actor: {kind: "control"},
        projectId: "project-a",
        details: {revisionId: "rev-1"},
      }),
      /hash mismatch/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
