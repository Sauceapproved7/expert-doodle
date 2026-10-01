import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {normalizeDeploymentRequest} from "./schema.mjs";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function activeModelPlaneMetadata(models = HERCULES_MODEL_SLOTS) {
  const active = models.filter((model) => model.state === "active");
  return {
    activeCount: active.length,
    modelIds: active.map((model) => model.id),
    models: active.map((model) => ({
      id: model.id,
      family: model.family,
      state: model.state,
      tasks: [...model.tasks],
      runtimeKind: model.runtime?.kind ?? null,
      checkpoint: model.checkpoint,
    })),
  };
}

export async function deploymentRequestFromActiveForgeRelease({
  forgeRoot,
  projectId,
  sourceCommit,
  publicOrigin,
  target,
  metadata = {},
} = {}) {
  if (!forgeRoot) throw new TypeError("forgeRoot is required");
  if (!projectId) throw new TypeError("projectId is required");

  const release = await readJson(join(forgeRoot, "releases", projectId, "active.json"));
  if (
    release.verified !== true ||
    !release.revisionId ||
    !release.artifactFingerprint ||
    release.projectId !== projectId
  ) {
    throw new Error("active Forge release is not verified");
  }

  return normalizeDeploymentRequest({
    serviceId: projectId,
    releaseId: release.revisionId,
    sourceCommit,
    artifactFingerprint: release.artifactFingerprint,
    publicOrigin,
    target,
    metadata: {
      ...metadata,
      forgeProjectId: projectId,
      forgeRevisionId: release.revisionId,
      forgeReleaseTarget: release.target,
      modelPlane: activeModelPlaneMetadata(),
    },
  });
}
