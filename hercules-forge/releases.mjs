import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";

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

  async publish({projectId, revision}) {
    const releaseDir = join(this.root, "releases", projectId);
    await mkdir(releaseDir, {recursive: true});

    const release = {
      projectId,
      revisionId: revision.revisionId,
      fingerprint: revision.fingerprint,
      publishedAt: new Date().toISOString(),
      target: "local-owned-release",
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

  async rollback({projectId, revisionId}) {
    const releaseDir = join(this.root, "releases", projectId);
    const release = await readJson(join(releaseDir, revisionId + ".json"));
    const rollback = {
      ...release,
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
