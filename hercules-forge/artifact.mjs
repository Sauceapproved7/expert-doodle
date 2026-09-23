import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, isAbsolute, join, normalize, sep} from "node:path";

const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function assertId(label, value) {
  if (!ID.test(String(value ?? ""))) {
    throw new Error(label + " must be a path-safe identifier");
  }
  return String(value);
}

function safeRelative(path) {
  const clean = normalize(path);
  if (isAbsolute(clean) || clean === ".." || clean.startsWith(".." + sep)) {
    throw new Error("artifact path escapes source root: " + path);
  }
  return clean;
}

function artifactFingerprint(manifest) {
  return sha256(JSON.stringify({
    artifactVersion: manifest.artifactVersion,
    projectId: manifest.projectId,
    revisionId: manifest.revisionId,
    revisionFingerprint: manifest.revisionFingerprint,
    files: manifest.files,
  }));
}

export async function buildForgeArtifact({
  workspaceRoot,
  artifactRoot,
  projectId,
  revisionId,
}) {
  projectId = assertId("projectId", projectId);
  revisionId = assertId("revisionId", revisionId);

  const revisionPath = join(
    workspaceRoot,
    "projects",
    projectId,
    "revisions",
    revisionId,
    "revision.json",
  );
  const revision = JSON.parse(await readFile(revisionPath, "utf8"));

  if (revision.projectId !== projectId || revision.revisionId !== revisionId) {
    throw new Error("revision identity mismatch");
  }

  const sourceRoot = join(
    workspaceRoot,
    "projects",
    projectId,
    "revisions",
    revisionId,
    "source",
  );
  const artifactDir = join(artifactRoot, projectId, revisionId);
  const bundleRoot = join(artifactDir, "bundle");
  await mkdir(bundleRoot, {recursive: true});

  const files = {};
  for (const [relativePath, expected] of Object.entries(revision.files)) {
    const safePath = safeRelative(relativePath);
    const source = await readFile(join(sourceRoot, safePath));
    const actualHash = sha256(source);

    if (actualHash !== expected.sha256) {
      throw new Error("revision source hash mismatch: " + relativePath);
    }

    const target = join(bundleRoot, safePath);
    await mkdir(dirname(target), {recursive: true});
    await writeFile(target, source);

    files[relativePath] = {
      sha256: actualHash,
      bytes: source.byteLength,
    };
  }

  const manifest = {
    artifactVersion: "0.1",
    projectId,
    revisionId,
    revisionFingerprint: revision.fingerprint,
    files,
    verified: true,
  };
  manifest.artifactFingerprint = artifactFingerprint(manifest);

  await writeFile(join(artifactDir, "artifact.json"), json(manifest), "utf8");
  return {artifactDir, manifest};
}

export async function verifyForgeArtifact(artifactDir) {
  const manifest = JSON.parse(await readFile(join(artifactDir, "artifact.json"), "utf8"));
  if (manifest.artifactVersion !== "0.1") {
    throw new Error("unsupported artifact version");
  }

  for (const [relativePath, expected] of Object.entries(manifest.files ?? {})) {
    const safePath = safeRelative(relativePath);
    const content = await readFile(join(artifactDir, "bundle", safePath));
    const actualHash = sha256(content);
    if (actualHash !== expected.sha256 || content.byteLength !== expected.bytes) {
      throw new Error("artifact verification failed: " + relativePath);
    }
  }

  const expectedFingerprint = artifactFingerprint(manifest);
  if (manifest.artifactFingerprint !== expectedFingerprint) {
    throw new Error("artifact manifest fingerprint mismatch");
  }

  return {...manifest, verified: true};
}
