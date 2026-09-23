import {createHash, randomUUID} from "node:crypto";
import {mkdir, readFile, readdir, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {compileForgeProject} from "./compiler.mjs";

const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export class ForgeWorkspaceStore {
  constructor(root) {
    this.root = root;
  }

  projectPath(projectId) {
    return join(this.root, "projects", projectId);
  }

  async createProject(spec, metadata = {}) {
    const compiled = compileForgeProject(spec);
    const projectId = metadata.projectId ?? randomUUID();
    const projectDir = this.projectPath(projectId);

    await mkdir(join(projectDir, "revisions"), {recursive: true});

    const project = {
      projectId,
      name: compiled.spec.name,
      createdAt: new Date().toISOString(),
      metadata,
    };

    await writeFile(join(projectDir, "project.json"), json(project), "utf8");
    const revision = await this.saveRevision(projectId, compiled.spec, {
      message: metadata.message ?? "Initial Forge project revision",
    });

    return {project, revision};
  }

  async saveRevision(projectId, spec, options = {}) {
    const compiled = compileForgeProject(spec);
    const projectDir = this.projectPath(projectId);
    await readJson(join(projectDir, "project.json"));

    const revisionId = options.revisionId ?? randomUUID();
    const revisionDir = join(projectDir, "revisions", revisionId);
    const sourceDir = join(revisionDir, "source");
    await mkdir(sourceDir, {recursive: true});

    const fileIndex = {};
    for (const [relativePath, content] of Object.entries(compiled.files)) {
      const target = join(sourceDir, relativePath);
      await mkdir(dirname(target), {recursive: true});
      await writeFile(target, content, "utf8");
      fileIndex[relativePath] = {
        sha256: sha256(content),
        bytes: Buffer.byteLength(content),
      };
    }

    const revision = {
      revisionId,
      projectId,
      createdAt: new Date().toISOString(),
      message: options.message ?? null,
      engine: compiled.engine,
      engineVersion: compiled.engineVersion,
      fingerprint: compiled.fingerprint,
      spec: compiled.spec,
      files: fileIndex,
    };

    await writeFile(join(revisionDir, "revision.json"), json(revision), "utf8");
    await writeFile(join(projectDir, "latest-revision.json"), json({revisionId}), "utf8");

    return revision;
  }

  async getProject(projectId) {
    return readJson(join(this.projectPath(projectId), "project.json"));
  }

  async getRevision(projectId, revisionId) {
    return readJson(join(this.projectPath(projectId), "revisions", revisionId, "revision.json"));
  }

  async getLatestRevision(projectId) {
    const latest = await readJson(join(this.projectPath(projectId), "latest-revision.json"));
    return this.getRevision(projectId, latest.revisionId);
  }

  async listRevisions(projectId) {
    const dir = join(this.projectPath(projectId), "revisions");
    const entries = await readdir(dir, {withFileTypes: true});
    const revisions = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      revisions.push(await this.getRevision(projectId, entry.name));
    }
    return revisions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async diffRevisions(projectId, fromRevisionId, toRevisionId) {
    const from = await this.getRevision(projectId, fromRevisionId);
    const to = await this.getRevision(projectId, toRevisionId);
    const paths = new Set([...Object.keys(from.files), ...Object.keys(to.files)]);
    const changes = [];

    for (const path of [...paths].sort()) {
      const a = from.files[path];
      const b = to.files[path];
      if (!a) changes.push({path, status: "added", from: null, to: b.sha256});
      else if (!b) changes.push({path, status: "deleted", from: a.sha256, to: null});
      else if (a.sha256 !== b.sha256) changes.push({path, status: "modified", from: a.sha256, to: b.sha256});
    }

    return {
      projectId,
      fromRevisionId,
      toRevisionId,
      changed: changes.length > 0,
      changes,
    };
  }
}
