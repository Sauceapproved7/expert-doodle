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

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("Coder neural v0.2 reconstructs the canonical candidate checkpoint", async () => {
  const runtime = await HerculesEmbeddedCoderNeuralV02.load();
  const output = runtime.infer(
    {prompt: "export function ", maxTokens: 16},
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
  assert.equal(typeof output.continuation, "string");
  assert.ok(output.tokenIds.length <= 16);
});

test("Coder candidate evaluation stays separate from production Coder routing", async () => {
  const candidateRuntime = await HerculesEmbeddedCoderNeuralV02.load();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    token,
    candidateEvaluationEnabled: true,
    candidateRuntimes: {
      "hercules-coder-neural-v02": candidateRuntime,
    },
  });
  const base = await listen(server);

  try {
    const candidateResponse = await fetch(base + "/v1/candidates/infer", {
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
    assert.equal(candidateResponse.status, 200);
    const candidateBody = await candidateResponse.json();
    assert.equal(candidateBody.candidate.id, "hercules-coder-neural-v02");
    assert.equal(candidateBody.candidate.state, "candidate");
    assert.equal(
      candidateBody.candidate.checkpoint,
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
      candidateBody.candidate.checkpoint,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Coder candidate rejects the general task", async () => {
  const runtime = await HerculesEmbeddedCoderNeuralV02.load();
  assert.throws(
    () => runtime.infer({prompt: "test"}, {task: "general"}),
    /requires code task/,
  );
});
