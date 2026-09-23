import test from "node:test";
import assert from "node:assert/strict";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {
  HERCULES_AGENT_ROUTER_CHECKPOINT_SHA256,
  HerculesEmbeddedAgentRouter,
} from "../hercules-models/embedded-agent-router.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "r".repeat(24);

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("embedded Hercules agent router reconstructs the attested checkpoint", async () => {
  const runtime = await HerculesEmbeddedAgentRouter.load();
  const result = runtime.infer("debug this node api and add a regression test");

  assert.equal(
    result.checkpoint,
    "sha256:" + HERCULES_AGENT_ROUTER_CHECKPOINT_SHA256,
  );
  assert.equal(result.modelId, "hercules-agent");
  assert.equal(result.route, "code");
});

test("model plane routes production agent inference through the native embedded runtime", async () => {
  const runtime = await HerculesEmbeddedAgentRouter.load();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    token,
    embeddedRuntimes: {
      "hercules-agent": runtime,
    },
  });
  const base = await listen(server);

  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.active, 8);
    assert.equal(healthBody.embeddedRuntimes, 1);

    const response = await fetch(base + "/v1/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        task: "agent",
        input: {text: "transcribe this voice recording into text"},
      }),
    });
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.model.id, "hercules-agent");
    assert.equal(
      body.model.checkpoint,
      "sha256:" + HERCULES_AGENT_ROUTER_CHECKPOINT_SHA256,
    );
    assert.equal(body.output.route, "speech");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("model plane fails closed if active embedded runtime is not loaded", async () => {
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    token,
    embeddedRuntimes: {},
  });
  const base = await listen(server);

  try {
    const response = await fetch(base + "/v1/infer", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        task: "agent",
        input: "research current documentation",
      }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "internal_error");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
