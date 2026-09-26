import test from "node:test";
import assert from "node:assert/strict";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {HERCULES_MODEL_CANDIDATES} from "../hercules-models/candidates.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "c".repeat(24);

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("Core neural v0.3 is registered as a non-routable candidate", () => {
  assert.equal(HERCULES_MODEL_CANDIDATES.length, 1);
  const candidate = HERCULES_MODEL_CANDIDATES[0];
  assert.equal(candidate.id, "hercules-core-neural-v03");
  assert.equal(candidate.family, "hercules-core");
  assert.equal(candidate.state, "candidate");
  assert.equal(candidate.origin, "hercules-native");
  assert.equal(candidate.runtime, null);
  assert.match(candidate.checkpoint, /^sha256:[a-f0-9]{64}$/);

  const activeCore = HERCULES_MODEL_SLOTS.find((model) => model.id === "hercules-core");
  assert.equal(activeCore.state, "active");
  assert.notEqual(activeCore.checkpoint, candidate.checkpoint);
});

test("model plane exposes candidate inventory without routing through candidates", async () => {
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    token,
    embeddedRuntimes: {},
  });
  const base = await listen(server);

  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.models, 8);
    assert.equal(healthBody.active, 8);
    assert.equal(healthBody.candidates, 1);

    const candidates = await fetch(base + "/v1/candidates", {
      headers: {authorization: "Bearer " + token},
    });
    assert.equal(candidates.status, 200);
    const candidateBody = await candidates.json();
    assert.equal(candidateBody.candidates.length, 1);
    assert.equal(candidateBody.candidates[0].id, "hercules-core-neural-v03");

    const route = await fetch(base + "/v1/route", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({task: "general"}),
    });
    assert.equal(route.status, 200);
    const routeBody = await route.json();
    assert.equal(routeBody.model.id, "hercules-core");
    assert.notEqual(routeBody.model.checkpoint, candidateBody.candidates[0].checkpoint);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("candidate inventory is authenticated", async () => {
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    candidates: HERCULES_MODEL_CANDIDATES,
    token,
  });
  const base = await listen(server);

  try {
    const response = await fetch(base + "/v1/candidates");
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
