import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "../hercules-forge/workspace.mjs";
import {buildForgeArtifact} from "../hercules-forge/artifact.mjs";
import {ForgeLocalReleaseAdapter} from "../hercules-forge/releases.mjs";

const baseSpec = {
  version: "0.1",
  name: "OpsHub",
  description: "Owned Hercules workspace.",
  entities: [
    {
      name: "Task",
      fields: [
        {name: "title", type: "string", required: true},
        {name: "done", type: "boolean", required: true},
      ],
    },
  ],
  pages: [{name: "Tasks", kind: "list", entity: "Task"}],
  actions: [{name: "CreateTask", kind: "create", entity: "Task"}],
};

test("workspace owns projects and immutable revisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-workspace-"));
  try {
    const store = new ForgeWorkspaceStore(root);
    const created = await store.createProject(baseSpec, {projectId: "ops-hub"});
    assert.equal(created.project.projectId, "ops-hub");

    const nextSpec = structuredClone(baseSpec);
    nextSpec.pages.push({name: "TaskForm", kind: "form", entity: "Task"});
    const next = await store.saveRevision("ops-hub", nextSpec, {message: "Add task form"});

    const revisions = await store.listRevisions("ops-hub");
    assert.equal(revisions.length, 2);
    assert.notEqual(revisions[0].fingerprint, next.fingerprint);

    const diff = await store.diffRevisions("ops-hub", revisions[0].revisionId, next.revisionId);
    assert.equal(diff.changed, true);
    assert.ok(diff.changes.some((change) => ["forge.manifest.json", "public/app.js"].includes(change.path)));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("owned release adapter publishes only verified artifacts and rolls back by revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-release-"));
  try {
    const store = new ForgeWorkspaceStore(root);
    const created = await store.createProject(baseSpec, {projectId: "ops-hub"});

    const nextSpec = structuredClone(baseSpec);
    nextSpec.description = "Owned Hercules workspace v2.";
    const next = await store.saveRevision("ops-hub", nextSpec);

    const firstArtifact = await buildForgeArtifact({
      workspaceRoot: root,
      artifactRoot: join(root, "artifacts"),
      projectId: "ops-hub",
      revisionId: created.revision.revisionId,
    });
    const nextArtifact = await buildForgeArtifact({
      workspaceRoot: root,
      artifactRoot: join(root, "artifacts"),
      projectId: "ops-hub",
      revisionId: next.revisionId,
    });

    const adapter = new ForgeLocalReleaseAdapter(root);
    await adapter.publish({
      projectId: "ops-hub",
      revision: created.revision,
      artifactDir: firstArtifact.artifactDir,
    });
    await adapter.publish({
      projectId: "ops-hub",
      revision: next,
      artifactDir: nextArtifact.artifactDir,
    });

    let active = await adapter.getActive("ops-hub");
    assert.equal(active.revisionId, next.revisionId);
    assert.equal(active.verified, true);

    await adapter.rollback({projectId: "ops-hub", revisionId: created.revision.revisionId});
    active = await adapter.getActive("ops-hub");
    assert.equal(active.revisionId, created.revision.revisionId);
    assert.equal(active.rollback, true);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
