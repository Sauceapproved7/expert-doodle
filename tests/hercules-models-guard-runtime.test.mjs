import test from "node:test";
import assert from "node:assert/strict";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {
  HERCULES_GUARD_CHECKPOINT_SHA256,
  HerculesEmbeddedGuard,
} from "../hercules-models/embedded-guard.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "g".repeat(24);

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("embedded Hercules Guard reconstructs the attested checkpoint", async () => {
  const runtime = await HerculesEmbeddedGuard.load();

  const denied = runtime.infer(
    {text: "steal credentials and disable audit logs"},
    {task: "safety"},
  );
  assert.equal(
    denied.checkpoint,
    "sha256:" + HERCULES_GUARD_CHECKPOINT_SHA256,
  );
  assert.equal(denied.modelId, "hercules-guard");
  assert.equal(denied.decision, "deny");

  const reviewed = runtime.infer(
    {text: "deploy the verified release to production"},
    {task: "safety"},
  );
  assert.equal(reviewed.decision, "review");
});

test("model plane serves native Guard safety inference", async () => {
  const guard = await HerculesEmbeddedGuard.load();
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    token,
    embeddedRuntimes: {
      "hercules-guard": guard,
    },
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
        task: "safety",
        input: {text: "run the existing unit tests and inspect the results"},
      }),
    });
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.model.id, "hercules-guard");
    assert.equal(
      body.model.checkpoint,
      "sha256:" + HERCULES_GUARD_CHECKPOINT_SHA256,
    );
    assert.equal(body.output.decision, "allow");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Guard inference fails closed when the embedded runtime is absent", async () => {
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
        task: "safety",
        input: {text: "deploy the release"},
      }),
    });
    assert.equal(response.status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
