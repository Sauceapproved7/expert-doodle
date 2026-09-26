import test from "node:test";
import assert from "node:assert/strict";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {HERCULES_MODEL_CANDIDATES} from "../hercules-models/candidates.mjs";
import {
  HERCULES_CORE_NEURAL_V03_CHECKPOINT_SHA256,
  HerculesEmbeddedCoreNeuralV03,
} from "../hercules-models/embedded-core-neural-v0.3.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "e".repeat(24);
let runtimePromise;

function getRuntime() {
  runtimePromise ??= HerculesEmbeddedCoreNeuralV03.load();
  return runtimePromise;
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("Core neural candidate reconstructs the canonical checkpoint before inference", async () => {
  const runtime = await getRuntime();
  const output = runtime.infer(
    {prompt: "Hercules ", maxTokens: 8},
    {task: "general"},
  );

  assert.equal(output.candidateId, "hercules-core-neural-v03");
  assert.equal(output.family, "hercules-core");
  assert.equal(
    output.checkpoint,
    "sha256:" + HERCULES_CORE_NEURAL_V03_CHECKPOINT_SHA256,
  );
  assert.equal(output.version, "0.3-candidate");
  assert.ok(output.continuation.length > 0);
});

test("candidate inference is denied by default", async () => {
  const runtime = await getRuntime();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    candidateRuntimes: {
      "hercules-core-neural-v03": runtime,
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
        candidateId: "hercules-core-neural-v03",
        task: "general",
        input: {prompt: "The model plane ", maxTokens: 8},
      }),
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /candidate evaluation is disabled/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("explicit candidate evaluation works without changing production routing", async () => {
  const runtime = await getRuntime();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    candidateRuntimes: {
      "hercules-core-neural-v03": runtime,
    },
    candidateEvaluationEnabled: true,
    token,
  });
  const base = await listen(server);

  try {
    const health = await fetch(base + "/health");
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
        candidateId: "hercules-core-neural-v03",
        task: "general",
        input: {prompt: "Hercules ", maxTokens: 8},
      }),
    });
    assert.equal(evaluation.status, 200);
    const evaluationBody = await evaluation.json();
    assert.equal(evaluationBody.candidate.state, "candidate");
    assert.equal(
      evaluationBody.candidate.checkpoint,
      "sha256:" + HERCULES_CORE_NEURAL_V03_CHECKPOINT_SHA256,
    );

    const productionRoute = await fetch(base + "/v1/route", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({task: "general"}),
    });
    assert.equal(productionRoute.status, 200);
    const productionBody = await productionRoute.json();
    assert.equal(productionBody.model.id, "hercules-core");
    assert.notEqual(
      productionBody.model.checkpoint,
      evaluationBody.candidate.checkpoint,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
