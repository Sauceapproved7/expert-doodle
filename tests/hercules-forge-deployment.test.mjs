import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ForgeWorkspaceStore} from "../hercules-forge/workspace.mjs";
import {buildForgeArtifact} from "../hercules-forge/artifact.mjs";
import {
  ForgeDeploymentTransport,
  ForgeRemoteReleaseAdapter,
  HttpForgeDeploymentTransport,
  createForgeDeploymentBundle,
} from "../hercules-forge/deployment.mjs";

const spec = {
  version: "0.1",
  name: "RemoteDeployApp",
  description: "Remote deployment fixture.",
  entities: [
    {name: "Item", fields: [{name: "name", type: "string", required: true}]},
  ],
  pages: [{name: "Items", kind: "list", entity: "Item"}],
  actions: [{name: "CreateItem", kind: "create", entity: "Item"}],
};

class MemoryDeploymentTransport extends ForgeDeploymentTransport {
  constructor() {
    super();
    this.published = [];
    this.activated = [];
  }

  async publish({bundle}) {
    this.published.push(bundle);
    return {
      deploymentId: "deployment-" + this.published.length,
      url: "https://apps.example.test/deployment-" + this.published.length,
    };
  }

  async activate(request) {
    this.activated.push(request);
    return {
      deploymentId: request.deploymentId,
      url: "https://apps.example.test/" + request.revisionId,
    };
  }
}

async function fixture(root) {
  const store = new ForgeWorkspaceStore(root);
  const created = await store.createProject(spec, {projectId: "remote-app"});
  const nextSpec = structuredClone(spec);
  nextSpec.description = "Remote deployment fixture v2.";
  const next = await store.saveRevision("remote-app", nextSpec);
  const firstArtifact = await buildForgeArtifact({
    workspaceRoot: root,
    artifactRoot: join(root, "artifacts"),
    projectId: "remote-app",
    revisionId: created.revision.revisionId,
  });
  const nextArtifact = await buildForgeArtifact({
    workspaceRoot: root,
    artifactRoot: join(root, "artifacts"),
    projectId: "remote-app",
    revisionId: next.revisionId,
  });
  return {created, next, firstArtifact, nextArtifact};
}

test("deployment bundle contains only a verified bounded artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-deployment-bundle-"));
  try {
    const {firstArtifact} = await fixture(root);
    const bundle = await createForgeDeploymentBundle(firstArtifact.artifactDir);
    assert.equal(bundle.protocol, "hercules-forge-deployment-bundle/0.1");
    assert.equal(bundle.manifest.verified, true);
    assert.equal(bundle.manifest.projectId, "remote-app");
    assert.ok(bundle.files.length > 0);
    assert.ok(bundle.totalBytes > 0);
    for (const file of bundle.files) {
      assert.equal(file.encoding, "base64");
      assert.equal(Buffer.from(file.content, "base64").byteLength, file.bytes);
      assert.match(file.sha256, /^[a-f0-9]{64}$/);
    }

    await assert.rejects(
      createForgeDeploymentBundle(firstArtifact.artifactDir, {maxBundleBytes: 1024}),
      /bundle byte limit/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("remote release adapter records remote deployment and activates verified rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-remote-release-"));
  try {
    const {created, next, firstArtifact, nextArtifact} = await fixture(root);
    const transport = new MemoryDeploymentTransport();
    const releases = new ForgeRemoteReleaseAdapter(root, {transport});

    const first = await releases.publish({
      projectId: "remote-app",
      revision: created.revision,
      artifactDir: firstArtifact.artifactDir,
    });
    const second = await releases.publish({
      projectId: "remote-app",
      revision: next,
      artifactDir: nextArtifact.artifactDir,
    });

    assert.equal(transport.published.length, 2);
    assert.equal(first.target, "remote-verified-deployment");
    assert.equal(first.deployment.deploymentId, "deployment-1");
    assert.equal(second.deployment.deploymentId, "deployment-2");

    let active = await releases.getActive("remote-app");
    assert.equal(active.revisionId, next.revisionId);
    assert.equal(active.deployment.deploymentId, "deployment-2");

    const rollback = await releases.rollback({
      projectId: "remote-app",
      revisionId: created.revision.revisionId,
    });
    assert.equal(transport.activated.length, 1);
    assert.equal(
      transport.activated[0].artifactFingerprint,
      first.artifactFingerprint,
    );
    assert.equal(rollback.rollback, true);
    assert.equal(rollback.revisionId, created.revision.revisionId);
    assert.equal(rollback.deployment.deploymentId, "deployment-1");

    active = await releases.getActive("remote-app");
    assert.equal(active.revisionId, created.revision.revisionId);
    assert.equal(active.rollback, true);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("remote release adapter refuses tampered artifact before transport", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-remote-tamper-"));
  try {
    const {created, firstArtifact} = await fixture(root);
    const transport = new MemoryDeploymentTransport();
    const releases = new ForgeRemoteReleaseAdapter(root, {transport});

    await writeFile(
      join(firstArtifact.artifactDir, "bundle", "server.mjs"),
      "tampered\n",
      "utf8",
    );

    await assert.rejects(
      releases.publish({
        projectId: "remote-app",
        revision: created.revision,
        artifactDir: firstArtifact.artifactDir,
      }),
      /artifact verification failed/,
    );
    assert.equal(transport.published.length, 0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("HTTP deployment transport is HTTPS-bound, no-redirect, bounded, and token-safe", async () => {
  const calls = [];
  const bearer = randomBytes(24).toString("base64url");
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    return {
      ok: true,
      status: 200,
      headers: {get: () => null},
      text: async () => JSON.stringify({
        deploymentId: "deploy-fixture",
        url: "https://apps.example.test/fixture",
      }),
    };
  };
  const transport = new HttpForgeDeploymentTransport({
    endpoint: "https://deploy.example.test/forge",
    token: bearer,
    fetchImpl,
  });
  const bundle = {
    protocol: "hercules-forge-deployment-bundle/0.1",
    manifest: {
      verified: true,
      artifactFingerprint: "a".repeat(64),
      projectId: "project-a",
      revisionId: "revision-a",
    },
    files: [],
    totalBytes: 0,
  };

  const published = await transport.publish({bundle});
  assert.equal(published.deploymentId, "deploy-fixture");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.headers.authorization, "Bearer " + bearer);
  assert.equal(calls[0].options.body.includes(bearer), false);
  assert.equal(JSON.parse(calls[0].options.body).action, "publish");

  await transport.activate({
    projectId: "project-a",
    revisionId: "revision-a",
    artifactFingerprint: "a".repeat(64),
    deploymentId: "deploy-fixture",
  });
  assert.equal(JSON.parse(calls[1].options.body).action, "activate");
  assert.equal(calls[1].options.body.includes(bearer), false);

  assert.throws(
    () => new HttpForgeDeploymentTransport({
      endpoint: "http://deploy.example.test/forge",
      fetchImpl,
    }),
    /must use https unless it is loopback/,
  );
  assert.throws(
    () => new HttpForgeDeploymentTransport({
      endpoint: "https://user:pass@deploy.example.test/forge",
      fetchImpl,
    }),
    /must not embed credentials/,
  );
});

test("HTTP deployment transport rejects redirect/error and oversized response", async () => {
  const bundle = {
    protocol: "hercules-forge-deployment-bundle/0.1",
    manifest: {verified: true, artifactFingerprint: "b".repeat(64)},
    files: [],
    totalBytes: 0,
  };

  const redirecting = new HttpForgeDeploymentTransport({
    endpoint: "https://deploy.example.test/forge",
    fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, "error");
      return {ok: false, status: 302, headers: {get: () => null}, text: async () => ""};
    },
  });
  await assert.rejects(redirecting.publish({bundle}), /status 302/);

  const oversized = new HttpForgeDeploymentTransport({
    endpoint: "https://deploy.example.test/forge",
    maxResponseBytes: 16,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: {get: (name) => name === "content-length" ? "1000" : null},
      text: async () => "",
    }),
  });
  await assert.rejects(oversized.publish({bundle}), /response too large/);
});
