import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {verifyForgeArtifact} from "./artifact.mjs";

const json = (value) => JSON.stringify(value, null, 2) + "\n";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

export class ForgeDeploymentAdapter {
  async publish() {
    throw new Error("ForgeDeploymentAdapter.publish must be implemented by a replaceable adapter");
  }

  async rollback() {
    throw new Error("ForgeDeploymentAdapter.rollback must be implemented by a replaceable adapter");
  }
}

export class ForgeLocalReleaseAdapter extends ForgeDeploymentAdapter {
  constructor(root) {
    super();
    this.root = root;
  }

  async publish({
    projectId,
    revision,
    artifactDir,
    target = "local-owned-release",
    deployment = null,
  }) {
    const artifact = await verifyForgeArtifact(artifactDir);

    if (artifact.projectId !== projectId) {
      throw new Error("artifact project does not match release project");
    }
    if (artifact.revisionId !== revision.revisionId) {
      throw new Error("artifact revision does not match release revision");
    }
    if (artifact.revisionFingerprint !== revision.fingerprint) {
      throw new Error("artifact fingerprint does not match release revision");
    }

    const releaseDir = join(this.root, "releases", projectId);
    await mkdir(releaseDir, {recursive: true});

    const release = {
      projectId,
      revisionId: revision.revisionId,
      fingerprint: revision.fingerprint,
      artifactFingerprint: artifact.artifactFingerprint,
      publishedAt: new Date().toISOString(),
      target,
      deployment,
      verified: true,
    };

    await writeFile(
      join(releaseDir, revision.revisionId + ".json"),
      json(release),
      "utf8",
    );
    await writeFile(
      join(releaseDir, "active.json"),
      json(release),
      "utf8",
    );
    return release;
  }

  async getRelease(projectId, revisionId) {
    return readJson(join(this.root, "releases", projectId, revisionId + ".json"));
  }

  async rollback({projectId, revisionId, deployment = undefined}) {
    const releaseDir = join(this.root, "releases", projectId);
    const release = await this.getRelease(projectId, revisionId);
    if (release.verified !== true || !release.artifactFingerprint) {
      throw new Error("cannot activate an unverified release");
    }

    const rollback = {
      ...release,
      ...(deployment === undefined ? {} : {deployment}),
      activatedAt: new Date().toISOString(),
      rollback: true,
    };
    await writeFile(join(releaseDir, "active.json"), json(rollback), "utf8");
    return rollback;
  }

  async getActive(projectId) {
    return readJson(join(this.root, "releases", projectId, "active.json"));
  }
}
