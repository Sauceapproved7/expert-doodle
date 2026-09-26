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

test("neural checkpoints are registered as non-routable candidates", () => {
  assert.equal(HERCULES_MODEL_CANDIDATES.length, 3);

  const byId = Object.fromEntries(
    HERCULES_MODEL_CANDIDATES.map((candidate) => [candidate.id, candidate]),
  );
  assert.deepEqual(Object.keys(byId).sort(), [
    "hercules-coder-neural-v02",
    "hercules-core-neural-v03",
    "hercules-research-neural-v02",
  ]);

  for (const candidate of HERCULES_MODEL_CANDIDATES) {
    assert.equal(candidate.state, "candidate");
    assert.equal(candidate.origin, "hercules-native");
    assert.equal(candidate.runtime, null);
    assert.match(candidate.checkpoint, /^sha256:[a-f0-9]{64}$/);

    const active = HERCULES_MODEL_SLOTS.find(
      (model) => model.id === candidate.family,
    );
    assert.ok(active);
    assert.equal(active.state, "active");
    assert.notEqual(active.checkpoint, candidate.checkpoint);
  }

  assert.deepEqual(byId["hercules-core-neural-v03"].tasks, ["general"]);
  assert.deepEqual(byId["hercules-coder-neural-v02"].tasks, ["code"]);
  assert.deepEqual(byId["hercules-research-neural-v02"].tasks, ["research"]);
});

test("model plane exposes candidates without routing production traffic through them", async () => {
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
    assert.equal(healthBody.candidates, 3);

    const candidates = await fetch(base + "/v1/candidates", {
      headers: {authorization: "Bearer " + token},
    });
    assert.equal(candidates.status, 200);
    const candidateBody = await candidates.json();
    assert.equal(candidateBody.candidates.length, 3);

    const byId = Object.fromEntries(
      candidateBody.candidates.map((candidate) => [candidate.id, candidate]),
    );

    for (const [task, activeId, candidateId] of [
      ["general", "hercules-core", "hercules-core-neural-v03"],
      ["code", "hercules-coder", "hercules-coder-neural-v02"],
      ["research", "hercules-research", "hercules-research-neural-v02"],
    ]) {
      const route = await fetch(base + "/v1/route", {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
        },
        body: JSON.stringify({task}),
      });
      assert.equal(route.status, 200);
      const body = await route.json();
      assert.equal(body.model.id, activeId);
      assert.equal(body.model.state, "active");
      assert.notEqual(body.model.checkpoint, byId[candidateId].checkpoint);
    }
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
