import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "../hercules-forge/workspace.mjs";
import {buildForgeArtifact, verifyForgeArtifact} from "../hercules-forge/artifact.mjs";

const spec = {
  version: "0.1",
  name: "ArtifactApp",
  description: "Artifact integrity fixture.",
  entities: [
    {name: "Item", fields: [{name: "name", type: "string", required: true}]},
  ],
  pages: [{name: "Items", kind: "list", entity: "Item"}],
  actions: [{name: "CreateItem", kind: "create", entity: "Item"}],
};

test("builds and verifies an artifact from an exact revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-artifact-"));
  try {
    const store = new ForgeWorkspaceStore(root);
    const {revision} = await store.createProject(spec, {projectId: "artifact-app"});

    const built = await buildForgeArtifact({
      workspaceRoot: root,
      artifactRoot: join(root, "artifacts"),
      projectId: "artifact-app",
      revisionId: revision.revisionId,
    });

    const verified = await verifyForgeArtifact(built.artifactDir);
    assert.equal(verified.verified, true);
    assert.equal(verified.revisionFingerprint, revision.fingerprint);
    assert.match(verified.artifactFingerprint, /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("artifact verification fails after source tampering", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-artifact-tamper-"));
  try {
    const store = new ForgeWorkspaceStore(root);
    const {revision} = await store.createProject(spec, {projectId: "artifact-app"});

    const built = await buildForgeArtifact({
      workspaceRoot: root,
      artifactRoot: join(root, "artifacts"),
      projectId: "artifact-app",
      revisionId: revision.revisionId,
    });

    await writeFile(join(built.artifactDir, "bundle", "server.mjs"), "tampered\n", "utf8");
    await assert.rejects(
      verifyForgeArtifact(built.artifactDir),
      /artifact verification failed/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
