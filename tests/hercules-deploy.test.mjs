import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {normalizeDeploymentRequest} from "../hercules-deploy/schema.mjs";
import {HerculesDeployStore} from "../hercules-deploy/store.mjs";
import {MemoryHerculesDeployTargetAdapter} from "../hercules-deploy/adapters.mjs";
import {HerculesDeployWorker} from "../hercules-deploy/worker.mjs";
import {deploymentRequestFromActiveForgeRelease} from "../hercules-deploy/forge-bridge.mjs";
import {createHerculesDeployService} from "../hercules-deploy/control-api.mjs";
import {
  readHerculesDeployConfig,
  safeHerculesDeployConfig,
} from "../hercules-deploy/service.mjs";

function runtimeSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function requestFixture(overrides = {}) {
  return {
    serviceId: "forge-customer-app",
    releaseId: "revision-001",
    sourceCommit: "a".repeat(40),
    artifactFingerprint: "b".repeat(64),
    publicOrigin: "https://app.example.test",
    target: {
      kind: "memory",
      reference: "fixture-target",
    },
    metadata: {
      environment: "test",
    },
    ...overrides,
  };
}

test("deployment schema is strict, HTTPS-only, and rejects secret-shaped metadata", () => {
  const normalized = normalizeDeploymentRequest(requestFixture());
  assert.equal(normalized.version, "0.1");
  assert.equal(normalized.publicOrigin, "https://app.example.test");

  assert.throws(
    () => normalizeDeploymentRequest(requestFixture({publicOrigin: "http://app.example.test"})),
    /must use https/,
  );
  assert.throws(
    () => normalizeDeploymentRequest(requestFixture({
      metadata: {nested: {accessToken: "not-allowed"}},
    })),
    /secret-shaped field/,
  );
  assert.throws(
    () => normalizeDeploymentRequest(requestFixture({
      target: {kind: "memory", reference: "https://user:pass@example.test"},
    })),
    /must not embed credentials/,
  );
});

test("deployment store persists immutable request and controlled state transitions with 0600 files", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-deploy-store-"));
  try {
    const store = new HerculesDeployStore(root);
    const created = await store.create(requestFixture(), {deploymentId: "deploy-a"});
    assert.equal(created.state.status, "queued");

    const requestPath = join(root, "deployments", "deploy-a", "request.json");
    const statePath = join(root, "deployments", "deploy-a", "state.json");
    assert.equal((await stat(requestPath)).mode & 0o777, 0o600);
    assert.equal((await stat(statePath)).mode & 0o777, 0o600);

    await store.transition("deploy-a", "running");
    await store.transition("deploy-a", "verifying", {
      deployEvidence: {targetId: "fixture-target"},
    });
    await store.transition("deploy-a", "verified", {
      verificationEvidence: {verified: true},
    });

    const deployment = await store.get("deploy-a");
    assert.equal(deployment.state.status, "verified");
    assert.equal(deployment.state.attempts, 1);
    assert.equal(deployment.state.verificationEvidence.verified, true);

    await assert.rejects(
      store.transition("deploy-a", "running"),
      /invalid deployment transition/,
    );
    await assert.rejects(
      store.transition("deploy-a", "rolling_back", {
        rollbackEvidence: {secretToken: "blocked"},
      }),
      /secret-shaped field/,
    );

    const persistedRequest = JSON.parse(await readFile(requestPath, "utf8"));
    assert.equal(persistedRequest.artifactFingerprint, "b".repeat(64));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("background worker deploys, verifies, rolls back, and safely retries adapter failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-deploy-worker-"));
  try {
    const store = new HerculesDeployStore(root);
    const adapters = new Map();
    const worker = new HerculesDeployWorker({store, adapters, pollIntervalMs: 100});

    await store.create(requestFixture(), {deploymentId: "deploy-retry"});
    await assert.rejects(worker.process("deploy-retry"), /target adapter unavailable/);
    let failed = await store.get("deploy-retry");
    assert.equal(failed.state.status, "failed");
    assert.equal(failed.state.lastErrorCode, "target_adapter_unavailable");

    adapters.set("memory", new MemoryHerculesDeployTargetAdapter());
    await worker.retry("deploy-retry");
    const verified = await worker.process("deploy-retry");
    assert.equal(verified.state.status, "verified");
    assert.equal(verified.state.attempts, 2);
    assert.equal(verified.state.verificationEvidence.verified, true);

    const rolledBack = await worker.rollback("deploy-retry");
    assert.equal(rolledBack.state.status, "rolled_back");
    assert.equal(rolledBack.state.rollbackEvidence.rolledBack, true);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("Forge bridge reads the actual verified active release", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-deploy-forge-"));
  try {
    const releaseDir = join(root, "releases", "project-a");
    await mkdir(releaseDir, {recursive: true});
    await writeFile(
      join(releaseDir, "active.json"),
      JSON.stringify({
        projectId: "project-a",
        revisionId: "revision-a",
        fingerprint: "c".repeat(64),
        artifactFingerprint: "d".repeat(64),
        publishedAt: new Date().toISOString(),
        target: "local-owned-release",
        verified: true,
      }, null, 2) + "\n",
      {encoding: "utf8", mode: 0o600},
    );

    const request = await deploymentRequestFromActiveForgeRelease({
      forgeRoot: root,
      projectId: "project-a",
      sourceCommit: "e".repeat(40),
      publicOrigin: "https://project-a.example.test",
      target: {kind: "memory", reference: "fixture-target"},
      metadata: {requestedBy: "test"},
    });

    assert.equal(request.serviceId, "project-a");
    assert.equal(request.releaseId, "revision-a");
    assert.equal(request.artifactFingerprint, "d".repeat(64));
    assert.equal(request.metadata.forgeRevisionId, "revision-a");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("Deploy Plane HTTP service processes queued jobs in the background", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-deploy-api-"));
  const controlToken = runtimeSecret();
  const adapters = new Map([["memory", new MemoryHerculesDeployTargetAdapter()]]);
  const service = createHerculesDeployService({
    root,
    token: controlToken,
    adapters,
    pollIntervalMs: 100,
    autoStartWorker: true,
  });
  await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + service.server.address().port;

  const authorized = {
    authorization: "Bearer " + controlToken,
    "content-type": "application/json",
  };

  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.service, "hercules-deploy-plane");
    assert.equal(healthBody.workerRunning, true);
    assert.deepEqual(healthBody.adapterKinds, ["memory"]);

    const denied = await fetch(base + "/v1/deployments");
    assert.equal(denied.status, 401);

    const created = await fetch(base + "/v1/deployments", {
      method: "POST",
      headers: authorized,
      body: JSON.stringify({
        deploymentId: "deploy-http",
        request: requestFixture(),
      }),
    });
    assert.equal(created.status, 201);

    let deployment;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const response = await fetch(base + "/v1/deployments/deploy-http", {
        headers: authorized,
      });
      deployment = await response.json();
      if (deployment.state?.status === "verified") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(deployment.state.status, "verified");

    const rollback = await fetch(base + "/v1/deployments/deploy-http/rollback", {
      method: "POST",
      headers: authorized,
    });
    assert.equal(rollback.status, 200);
    assert.equal((await rollback.json()).state.status, "rolled_back");
  } finally {
    await new Promise((resolve) => service.server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});

test("Deploy Plane production config keeps control credentials out of safe summary", () => {
  const controlToken = runtimeSecret();
  const config = readHerculesDeployConfig({
    HERCULES_DEPLOY_ROOT: "/tmp/hercules-deploy",
    HERCULES_DEPLOY_CONTROL_TOKEN: controlToken,
    HERCULES_DEPLOY_HOST: "127.0.0.1",
    HERCULES_DEPLOY_PORT: "38800",
    HERCULES_DEPLOY_POLL_MS: "750",
  });
  const safe = safeHerculesDeployConfig(config);
  assert.equal(safe.pollIntervalMs, 750);
  assert.equal("token" in safe, false);
  assert.equal(JSON.stringify(safe).includes(controlToken), false);
});
