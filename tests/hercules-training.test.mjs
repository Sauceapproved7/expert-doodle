import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {HttpTrainingRunner} from "../hercules-training/runner.mjs";
import {
  validateDatasetManifest,
  validateEvaluationSuite,
} from "../hercules-training/schema.mjs";
import {createTrainingControlService} from "../hercules-training/service.mjs";

const token = "t".repeat(24);
const commit = "a".repeat(40);
const dataSha = "b".repeat(64);
const checkpointSha = "c".repeat(64);
const evidenceSha = "d".repeat(64);

function dataset(overrides = {}) {
  return {
    version: "0.1",
    id: "agent-bootstrap",
    description: "Hercules-authored bootstrap agent-routing examples.",
    sourceUri: "repo://hercules-training/bootstrap/agent-routing.jsonl",
    sourceType: "hercules-authored",
    contentSha256: dataSha,
    recordCount: 32,
    license: "Apache-2.0",
    rightsBasis: "Original Hercules project training material.",
    trainingAllowed: true,
    createdAt: "2026-09-23T20:00:00Z",
    provenance: {
      origin: "Hercules repository",
      acquiredBy: "Sauceapproved7",
      sourceCommit: commit,
      notes: "Test fixture.",
    },
    ...overrides,
  };
}

function suite() {
  return {
    version: "0.1",
    id: "agent-routing-gate",
    task: "agent",
    description: "Requires a minimum routing accuracy before activation.",
    thresholds: [
      {metric: "accuracy", op: "gte", value: 0.8},
      {metric: "error-rate", op: "lte", value: 0.2},
    ],
    sourceCommit: commit,
  };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

async function post(base, path, body) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return {status: response.status, body: await response.json()};
}

test("dataset admission fails closed on unknown rights or missing training permission", () => {
  const unknown = validateDatasetManifest(dataset({license: "unknown"}));
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors.join(" "), /license must be known/);

  const notAllowed = validateDatasetManifest(dataset({trainingAllowed: false}));
  assert.equal(notAllowed.ok, false);
  assert.match(notAllowed.errors.join(" "), /trainingAllowed must be explicitly true/);
});

test("evaluation suite fingerprints are deterministic", () => {
  const first = validateEvaluationSuite(suite());
  const second = validateEvaluationSuite(structuredClone(suite()));
  assert.equal(first.ok, true);
  assert.equal(first.fingerprint, second.fingerprint);
});

test("HTTP training runner uses owned worker protocol and refuses redirects", async () => {
  let received;
  const worker = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    res.writeHead(200, {"content-type": "application/json"});
    res.end(JSON.stringify({
      id: "checkpoint-one",
      artifactSha256: checkpointSha,
      bytes: 128,
      format: "json",
      framework: "hercules-native-test",
      createdAt: "2026-09-23T20:05:00Z",
    }));
  });
  const workerBase = await listen(worker);

  const redirector = http.createServer((req, res) => {
    res.writeHead(302, {location: workerBase + "/run"});
    res.end();
  });
  const redirectBase = await listen(redirector);

  try {
    const runner = new HttpTrainingRunner({endpoint: workerBase + "/run"});
    const result = await runner.run({
      job: {id: "job-one"},
      datasets: [dataset()],
    });
    assert.equal(result.id, "checkpoint-one");
    assert.equal(received.protocol, "hercules-training-worker/0.1");

    await assert.rejects(
      new HttpTrainingRunner({endpoint: redirectBase + "/run"}).run({
        job: {id: "redirect-job"},
        datasets: [dataset()],
      }),
    );
  } finally {
    await new Promise((resolve) => redirector.close(resolve));
    await new Promise((resolve) => worker.close(resolve));
  }
});

test("training control records provenance, runner output, evaluation, and activation", async () => {
  const root = await mkdtemp(join(tmpdir(), "hercules-training-"));
  const runner = {
    async run({job}) {
      return {
        id: "agent-checkpoint-one",
        modelId: job.modelId,
        artifactSha256: checkpointSha,
        bytes: 4096,
        format: "json",
        framework: "hercules-native-test",
        parentCheckpointSha256: null,
        createdAt: "2026-09-23T20:10:00Z",
      };
    },
  };

  const server = createTrainingControlService({
    root,
    token,
    models: HERCULES_MODEL_SLOTS,
    runner,
  });
  const base = await listen(server);

  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.models, 8);
    assert.equal(healthBody.runnerConfigured, true);

    const badJob = await post(base, "/v1/jobs", {
      id: "bad-job",
      modelId: "not-a-hercules-model",
      task: "agent",
      datasetIds: ["agent-bootstrap"],
      seed: 7,
      codeCommit: commit,
      trainer: {engine: "hercules-native", version: "0.1", entrypoint: "train"},
      createdAt: "2026-09-23T20:00:00Z",
    });
    assert.equal(badJob.status, 400);

    const admitted = await post(base, "/v1/datasets", dataset());
    assert.equal(admitted.status, 201);
    assert.match(admitted.body.fingerprint, /^[a-f0-9]{64}$/);

    const planned = await post(base, "/v1/jobs", {
      id: "agent-job-one",
      modelId: "hercules-agent",
      task: "agent",
      datasetIds: ["agent-bootstrap"],
      seed: 7,
      codeCommit: commit,
      trainer: {
        engine: "hercules-native",
        version: "0.1",
        entrypoint: "hercules-training/native-agent-router.mjs",
      },
      hyperparameters: {epochs: 2},
      createdAt: "2026-09-23T20:01:00Z",
    });
    assert.equal(planned.status, 201);
    assert.match(planned.body.fingerprint, /^[a-f0-9]{64}$/);

    const trained = await post(base, "/v1/jobs/agent-job-one/run", {});
    assert.equal(trained.status, 201);
    assert.equal(trained.body.checkpoint.modelId, "hercules-agent");
    assert.equal(trained.body.checkpoint.jobFingerprint, planned.body.fingerprint);

    const suiteBody = suite();
    const suiteCreated = await post(base, "/v1/suites", suiteBody);
    assert.equal(suiteCreated.status, 201);

    const failedEval = await post(base, "/v1/evaluations", {
      version: "0.1",
      id: "agent-eval-fail",
      suiteId: "agent-routing-gate",
      suiteFingerprint: suiteCreated.body.fingerprint,
      checkpointSha256: checkpointSha,
      metrics: {accuracy: 0.5, "error-rate": 0.5},
      evidenceSha256: evidenceSha,
      createdAt: "2026-09-23T20:12:00Z",
    });
    assert.equal(failedEval.status, 201);

    const rejected = await post(base, "/v1/activations/check", {
      modelId: "hercules-agent",
      checkpointId: "agent-checkpoint-one",
      requiredSuiteIds: ["agent-routing-gate"],
      runtime: {kind: "http", endpoint: "http://127.0.0.1:39000/infer"},
    });
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.ok, false);

    const root2 = await mkdtemp(join(tmpdir(), "hercules-training-pass-"));
    const server2 = createTrainingControlService({
      root: root2,
      token,
      models: HERCULES_MODEL_SLOTS,
      runner,
    });
    const base2 = await listen(server2);
    try {
      await post(base2, "/v1/datasets", dataset());
      const planned2 = await post(base2, "/v1/jobs", {
        id: "agent-job-two",
        modelId: "hercules-agent",
        task: "agent",
        datasetIds: ["agent-bootstrap"],
        seed: 7,
        codeCommit: commit,
        trainer: {
          engine: "hercules-native",
          version: "0.1",
          entrypoint: "hercules-training/native-agent-router.mjs",
        },
        createdAt: "2026-09-23T20:15:00Z",
      });
      assert.equal(planned2.status, 201);

      await post(base2, "/v1/jobs/agent-job-two/run", {});
      const suite2 = await post(base2, "/v1/suites", suiteBody);
      assert.equal(suite2.status, 201);

      const passedEval = await post(base2, "/v1/evaluations", {
        version: "0.1",
        id: "agent-eval-pass",
        suiteId: "agent-routing-gate",
        suiteFingerprint: suite2.body.fingerprint,
        checkpointSha256: checkpointSha,
        metrics: {accuracy: 0.95, "error-rate": 0.05},
        evidenceSha256: evidenceSha,
        createdAt: "2026-09-23T20:16:00Z",
      });
      assert.equal(passedEval.status, 201);

      const accepted = await post(base2, "/v1/activations/check", {
        activationId: "agent-activation-one",
        modelId: "hercules-agent",
        checkpointId: "agent-checkpoint-one",
        requiredSuiteIds: ["agent-routing-gate"],
        runtime: {kind: "http", endpoint: "http://127.0.0.1:39000/infer"},
      });
      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.ok, true);
      assert.equal(accepted.body.activatedModel.state, "active");
      assert.equal(
        accepted.body.activatedModel.checkpoint,
        "sha256:" + checkpointSha,
      );
    } finally {
      await new Promise((resolve) => server2.close(resolve));
      await rm(root2, {recursive: true, force: true});
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
