import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  DeploymentFlightRecorder,
  HerculesReleaseAdmissionGate,
} from "../hercules-deploy/admission.mjs";
import {HerculesDeployStore} from "../hercules-deploy/store.mjs";
import {HerculesDeployWorker} from "../hercules-deploy/worker.mjs";
import {readHerculesDeployConfig} from "../hercules-deploy/service.mjs";

function requestFixture() {
  return {
    serviceId: "forge-customer-app",
    releaseId: "revision-001",
    sourceCommit: "a".repeat(40),
    artifactFingerprint: "b".repeat(64),
    publicOrigin: "https://app.example.test",
    target: {kind: "memory", reference: "fixture-target"},
    metadata: {environment: "production"},
  };
}

test("recovery flight recorder persists a verified append-only hash chain", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-recovery-flight-"));
  try {
    const recorder = new DeploymentFlightRecorder(root);
    const first = await recorder.append({
      deploymentId: "deploy-a",
      type: "release.admission",
      outcome: "success",
      details: {releaseId: "revision-001", artifactFingerprint: "b".repeat(64)},
    });
    const second = await recorder.append({
      deploymentId: "deploy-a",
      type: "deployment.verified",
      outcome: "success",
      details: {publicOrigin: "https://app.example.test"},
    });

    assert.equal(first.sequence, 1);
    assert.equal(first.previousHash, null);
    assert.equal(second.sequence, 2);
    assert.equal(second.previousHash, first.hash);
    assert.match(second.hash, /^[a-f0-9]{64}$/);

    const verified = await recorder.verify();
    assert.equal(verified.verified, true);
    assert.equal(verified.events, 2);
    assert.equal(verified.lastHash, second.hash);

    const text = await readFile(recorder.path, "utf8");
    await writeFile(
      recorder.path,
      text.replace('"revision-001"', '"revision-tampered"'),
      "utf8",
    );
    await assert.rejects(recorder.verify(), /hash mismatch/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("release admission binds deployment identity before target mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-recovery-admission-"));
  try {
    const recorder = new DeploymentFlightRecorder(root);
    const gate = new HerculesReleaseAdmissionGate({recorder});
    const deployment = {
      deploymentId: "deploy-a",
      request: requestFixture(),
      state: {status: "running"},
    };

    const evidence = await gate.admit(deployment);
    assert.equal(evidence.admitted, true);
    assert.equal(evidence.deploymentId, "deploy-a");
    assert.equal(evidence.releaseId, "revision-001");
    assert.equal(evidence.sourceCommit, "a".repeat(40));
    assert.equal(evidence.artifactFingerprint, "b".repeat(64));
    assert.equal((await recorder.verify()).events, 1);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("worker fails closed when release admission rejects and never calls deploy adapter", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-deploy-admission-"));
  try {
    const store = new HerculesDeployStore(root);
    await store.create(requestFixture(), {deploymentId: "deploy-a"});

    let deployCalled = false;
    const adapter = {
      async deploy() {
        deployCalled = true;
        return {};
      },
      async verify() {
        return {verified: true};
      },
      async rollback() {
        return {rolledBack: true};
      },
    };
    const admissionGate = {
      async admit() {
        throw Object.assign(new Error("release admission denied"), {
          code: "release_admission_denied",
        });
      },
    };
    const worker = new HerculesDeployWorker({
      store,
      adapters: new Map([["memory", adapter]]),
      admissionGate,
    });

    await assert.rejects(worker.process("deploy-a"), /release admission denied/);
    assert.equal(deployCalled, false);
    const failed = await store.get("deploy-a");
    assert.equal(failed.state.status, "failed");
    assert.equal(failed.state.lastErrorCode, "release_admission_denied");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("deploy config requires recovery storage outside the primary deploy root", () => {
  const base = "/tmp/hercules-plane";
  assert.throws(
    () => readHerculesDeployConfig({
      HERCULES_DEPLOY_ROOT: base,
      HERCULES_DEPLOY_CONTROL_TOKEN: "x".repeat(32),
    }),
    /HERCULES_DEPLOY_RECOVERY_ROOT is required/,
  );

  assert.throws(
    () => readHerculesDeployConfig({
      HERCULES_DEPLOY_ROOT: base,
      HERCULES_DEPLOY_RECOVERY_ROOT: join(base, "recovery"),
      HERCULES_DEPLOY_CONTROL_TOKEN: "x".repeat(32),
    }),
    /must be independent/,
  );

  const config = readHerculesDeployConfig({
    HERCULES_DEPLOY_ROOT: base,
    HERCULES_DEPLOY_RECOVERY_ROOT: "/tmp/hercules-recovery",
    HERCULES_DEPLOY_CONTROL_TOKEN: "x".repeat(32),
  });
  assert.equal(config.recoveryRoot, "/tmp/hercules-recovery");
});
