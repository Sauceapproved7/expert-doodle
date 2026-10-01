import test from "node:test";
import assert from "node:assert/strict";

import {deploymentRequestFromActiveForgeRelease} from "../hercules-deploy/forge-bridge.mjs";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";

test("Forge deployment requests carry only the active Hercules model plane", async (t) => {
  const {mkdtemp, mkdir, writeFile, rm} = await import("node:fs/promises");
  const {tmpdir} = await import("node:os");
  const {join} = await import("node:path");
  const root = await mkdtemp(join(tmpdir(), "hercules-model-deploy-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  await mkdir(join(root, "releases", "forge-app"), {recursive: true});
  await writeFile(join(root, "releases", "forge-app", "active.json"), JSON.stringify({
    verified: true,
    revisionId: "rev-1",
    artifactFingerprint: "a".repeat(64),
    projectId: "forge-app",
    target: "staging"
  }));

  const request = await deploymentRequestFromActiveForgeRelease({
    forgeRoot: root,
    projectId: "forge-app",
    sourceCommit: "b".repeat(40),
    publicOrigin: "https://staging.sauceapproved.com",
    target: {kind: "memory", reference: "staging"}
  });

  assert.equal(request.metadata.modelPlane.activeCount, HERCULES_MODEL_SLOTS.length);
  assert.deepEqual(request.metadata.modelPlane.modelIds, HERCULES_MODEL_SLOTS.map((model) => model.id));
  assert.ok(request.metadata.modelPlane.models.every((model) => model.state === "active"));
  assert.ok(request.metadata.modelPlane.models.every((model) => model.runtimeKind === "embedded"));
});
