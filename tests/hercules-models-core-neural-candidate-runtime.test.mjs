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

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("Core neural v0.3 reconstructs the canonical candidate checkpoint", async () => {
  const runtime = await HerculesEmbeddedCoreNeuralV03.load();
  const output = runtime.infer(
    {prompt: "Hercules ", maxTokens: 12},
    {task: "general"},
  );

  assert.equal(output.candidateId, "hercules-core-neural-v03");
  assert.equal(output.family, "hercules-core");
  assert.equal(
    output.checkpoint,
    "sha256:" + HERCULES_CORE_NEURAL_V03_CHECKPOINT_SHA256,
  );
  assert.equal(output.version, "0.3-candidate");
  assert.equal(output.task, "general");
  assert.equal(typeof output.continuation, "string");
  assert.ok(output.tokenIds.length <= 12);
});

test("candidate inference is disabled by default", async () => {
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
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
        input: {prompt: "Hercules "},
      }),
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "candidate evaluation is disabled");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("explicit candidate evaluation does not change production routing", async () => {
  const candidateRuntime = await HerculesEmbeddedCoreNeuralV03.load();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    token,
    candidateEvaluationEnabled: true,
    candidateRuntimes: {
      "hercules-core-neural-v03": candidateRuntime,
    },
  });
  const base = await listen(server);

  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.candidateEvaluationEnabled, true);
    assert.equal(healthBody.candidateRuntimes, 1);
    assert.equal(healthBody.active, 8);

    const candidateResponse = await fetch(base + "/v1/candidates/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        candidateId: "hercules-core-neural-v03",
        task: "general",
        input: {prompt: "The model plane ", maxTokens: 10},
      }),
    });
    assert.equal(candidateResponse.status, 200);
    const candidateBody = await candidateResponse.json();
    assert.equal(candidateBody.candidate.id, "hercules-core-neural-v03");
    assert.equal(candidateBody.candidate.state, "candidate");
    assert.equal(
      candidateBody.candidate.checkpoint,
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
    assert.equal(productionBody.model.state, "active");
    assert.notEqual(
      productionBody.model.checkpoint,
      candidateBody.candidate.checkpoint,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("candidate evaluation rejects unsupported tasks and unloaded runtimes", async () => {
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    token,
    candidateEvaluationEnabled: true,
    candidateRuntimes: {},
  });
  const base = await listen(server);

  try {
    const unsupported = await fetch(base + "/v1/candidates/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        candidateId: "hercules-core-neural-v03",
        task: "code",
        input: {prompt: "test"},
      }),
    });
    assert.equal(unsupported.status, 400);

    const unloaded = await fetch(base + "/v1/candidates/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        candidateId: "hercules-core-neural-v03",
        task: "general",
        input: {prompt: "test"},
      }),
    });
    assert.equal(unloaded.status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
