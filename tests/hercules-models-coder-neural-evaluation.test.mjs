import test from "node:test";
import assert from "node:assert/strict";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {HERCULES_MODEL_CANDIDATES} from "../hercules-models/candidates.mjs";
import {
  HERCULES_CODER_NEURAL_V02_CHECKPOINT_SHA256,
  HerculesEmbeddedCoderNeuralV02,
} from "../hercules-models/embedded-coder-neural-v0.2.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "d".repeat(24);
let runtimePromise;

function getRuntime() {
  runtimePromise ??= HerculesEmbeddedCoderNeuralV02.load();
  return runtimePromise;
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("Coder neural candidate reconstructs the canonical checkpoint before inference", async () => {
  const runtime = await getRuntime();
  const output = runtime.infer(
    {prompt: "export function ", maxTokens: 12},
    {task: "code"},
  );

  assert.equal(output.candidateId, "hercules-coder-neural-v02");
  assert.equal(output.family, "hercules-coder");
  assert.equal(
    output.checkpoint,
    "sha256:" + HERCULES_CODER_NEURAL_V02_CHECKPOINT_SHA256,
  );
  assert.equal(output.version, "0.2-candidate");
  assert.equal(output.task, "code");
  assert.ok(output.continuation.length > 0);
});

test("Coder candidate inference is denied by default", async () => {
  const runtime = await getRuntime();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    candidateRuntimes: {
      "hercules-coder-neural-v02": runtime,
    },
    token,
  });
  const base = await listen(server);

  try {
    const response = await fetch(base + "/v1/candidates/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        candidateId: "hercules-coder-neural-v02",
        task: "code",
        input: {prompt: "test(", maxTokens: 8},
      }),
    });

    assert.equal(response.status, 403);
    assert.match(
      (await response.json()).error,
      /candidate evaluation is disabled/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("explicit Coder candidate evaluation does not change production code routing", async () => {
  const runtime = await getRuntime();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    candidateRuntimes: {
      "hercules-coder-neural-v02": runtime,
    },
    candidateEvaluationEnabled: true,
    token,
  });
  const base = await listen(server);

  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.candidateEvaluationEnabled, true);
    assert.equal(healthBody.candidateRuntimes, 1);

    const evaluation = await fetch(base + "/v1/candidates/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        candidateId: "hercules-coder-neural-v02",
        task: "code",
        input: {prompt: "export function ", maxTokens: 12},
      }),
    });
    assert.equal(evaluation.status, 200);

    const evaluationBody = await evaluation.json();
    assert.equal(evaluationBody.candidate.state, "candidate");
    assert.equal(evaluationBody.candidate.id, "hercules-coder-neural-v02");
    assert.equal(
      evaluationBody.candidate.checkpoint,
      "sha256:" + HERCULES_CODER_NEURAL_V02_CHECKPOINT_SHA256,
    );

    const productionRoute = await fetch(base + "/v1/route", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({task: "code"}),
    });
    assert.equal(productionRoute.status, 200);

    const productionBody = await productionRoute.json();
    assert.equal(productionBody.model.id, "hercules-coder");
    assert.equal(productionBody.model.state, "active");
    assert.notEqual(
      productionBody.model.checkpoint,
      evaluationBody.candidate.checkpoint,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Coder candidate rejects the wrong task", async () => {
  const runtime = await getRuntime();
  assert.throws(
    () => runtime.infer({prompt: "export function "}, {task: "general"}),
    /requires code task/,
  );
});
